/*
 * AI-USAGE SUMMARY
 * Model: Claude Opus 4.8
 * Overall AI Contribution: ~85%
 * AI-Assisted Areas: Test structure, fetch/localStorage/ReadableStream mock setup, and the SSE wire fixtures.
 * Human Contributions: Chose the cases that matter (auth header from stored session, JSON error unwrapping, 204 handling, and the streamMessage dispatch across both \n\n and \r\n\r\n frame boundaries) and verified them against the actual pulseApi behavior.
 */

import { TextDecoder, TextEncoder } from "util";

// jsdom doesn't expose these Web encoding globals; pulseApi's SSE reader and
// the stream fixtures below both need them.
globalThis.TextEncoder = globalThis.TextEncoder || TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || TextDecoder;

import { pulseApi } from "../lib/pulseApi";

const SESSION_KEY = "healthnest.session";

// Build a ReadableStream-like body that yields the given UTF-8 string chunks,
// matching the res.body.getReader() interface streamMessage consumes.
function streamBody(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (i < chunks.length) {
            return Promise.resolve({
              value: encoder.encode(chunks[i++]),
              done: false,
            });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

describe("pulseApi", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("auth + jsonRequest (via listConversations)", () => {
    test("sends an Authorization header when a session token is stored", async () => {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ access_token: "tok-123" }),
      );
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await pulseApi.listConversations();

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers.Authorization).toBe("Bearer tok-123");
    });

    test("omits the Authorization header when no session is stored", async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      await pulseApi.listConversations();

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers.Authorization).toBeUndefined();
    });

    test("returns parsed JSON on success", async () => {
      const rows = [{ id: "c1" }];
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(rows),
      });

      await expect(pulseApi.listConversations()).resolves.toEqual(rows);
    });

    test("throws with the server detail string on error", async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "conversation not found" }),
      });

      await expect(pulseApi.getConversation("missing")).rejects.toThrow(
        "conversation not found",
      );
    });

    test("unwraps a validation-error detail array", async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable",
        json: () => Promise.resolve({ detail: [{ msg: "field required" }] }),
      });

      await expect(pulseApi.getConversation("x")).rejects.toThrow(
        "field required",
      );
    });

    test("returns null on a 204 No Content", async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      });

      await expect(pulseApi.deleteConversation("c1")).resolves.toBeNull();
    });
  });

  describe("createConversation", () => {
    test("POSTs a null title by default", async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: "c1" }),
      });

      await pulseApi.createConversation();

      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain("/ai/conversations");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ title: null });
    });
  });

  describe("streamMessage", () => {
    test("dispatches delta / skill_output / citation / done callbacks", async () => {
      const frames = [
        'event: delta\ndata: {"text":"Hello"}\n\n',
        'event: skill_output\ndata: {"skill":"get_appointments","payload":{}}\n\n',
        'event: citation\ndata: {"source":"records","snippet":"x"}\n\n',
        'event: done\ndata: {}\n\n',
      ].join("");

      fetch.mockResolvedValue({ ok: true, body: streamBody([frames]) });

      const onDelta = jest.fn();
      const onSkillOutput = jest.fn();
      const onCitation = jest.fn();
      const onDone = jest.fn();

      await pulseApi.streamMessage("c1", "hi", {
        onDelta,
        onSkillOutput,
        onCitation,
        onDone,
      });

      expect(onDelta).toHaveBeenCalledWith("Hello");
      expect(onSkillOutput).toHaveBeenCalledWith(
        expect.objectContaining({ skill: "get_appointments" }),
      );
      expect(onCitation).toHaveBeenCalledWith(
        expect.objectContaining({ source: "records" }),
      );
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    test("reassembles frames split across read() chunks", async () => {
      // The "delta" frame is delivered in two network reads.
      fetch.mockResolvedValue({
        ok: true,
        body: streamBody(['event: delta\ndata: {"text":"par', 'tial"}\n\n']),
      });

      const onDelta = jest.fn();
      await pulseApi.streamMessage("c1", "hi", { onDelta });

      expect(onDelta).toHaveBeenCalledWith("partial");
    });

    test("parses CRLF-delimited frames", async () => {
      fetch.mockResolvedValue({
        ok: true,
        body: streamBody(['event: delta\r\ndata: {"text":"crlf"}\r\n\r\n']),
      });

      const onDelta = jest.fn();
      await pulseApi.streamMessage("c1", "hi", { onDelta });

      expect(onDelta).toHaveBeenCalledWith("crlf");
    });

    test("calls onError when the response is not ok", async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        json: () => Promise.resolve({ detail: "boom" }),
      });

      const onError = jest.fn();
      await pulseApi.streamMessage("c1", "hi", { onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test("calls onError when fetch itself rejects", async () => {
      fetch.mockRejectedValue(new Error("network down"));

      const onError = jest.fn();
      await pulseApi.streamMessage("c1", "hi", { onError });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
