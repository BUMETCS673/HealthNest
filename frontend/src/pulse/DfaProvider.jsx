/**
 * AI-USAGE SUMMARY
 * Tools: ChatGPT
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Mirrored PulseProvider.jsx for the doctor-facing assistant (SCRUM-27),
 * replacing pulseApi with dfaApi throughout and adding safer streaming/error handling.
 * Human Contributions: Verified context shape matches the patient Pulse provider pattern,
 * confirmed route alignment with dfa_router in backend/ai/router.py, and reviewed that
 * the provider can support reused or mirrored Pulse UI components for DFA.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { dfaApi } from "../lib/dfaApi";

const DfaContext = createContext(null);

export function useDfa() {
  const ctx = useContext(DfaContext);
  if (!ctx) {
    throw new Error("useDfa must be used inside <DfaProvider>");
  }
  return ctx;
}

function makeOptimisticMessage(role, extra = {}) {
  return {
    id: `local-${crypto.randomUUID()}`,
    role,
    content: "",
    skill_outputs: [],
    citations: [],
    created_at: new Date().toISOString(),
    ...extra,
  };
}

export default function DfaProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [error, setError] = useState(null);

  const streamControllerRef = useRef(null);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await dfaApi.listConversations();
      setConversations(rows || []);
    } catch (err) {
      setError(err.message || "Failed to load DFA conversations");
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;

    try {
      setError(null);
      const detail = await dfaApi.getConversation(id);
      setActiveId(detail.id);
      setMessages(detail.messages || []);
    } catch (err) {
      setError(err.message || "Failed to load DFA conversation");
    }
  }, []);

  const ensureConversation = useCallback(async () => {
    if (activeId) return activeId;

    const created = await dfaApi.createConversation({});
    setActiveId(created.id);
    setConversations((prev) => [created, ...prev]);

    return created.id;
  }, [activeId]);

  const newConversation = useCallback(async () => {
    try {
      setError(null);
      const created = await dfaApi.createConversation({});
      setActiveId(created.id);
      setMessages([]);
      setConversations((prev) => [created, ...prev]);
      return created.id;
    } catch (err) {
      setError(err.message || "Failed to create DFA conversation");
      return null;
    }
  }, []);

  const stopStreaming = useCallback(() => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setStreaming(false);
    setStreamingId(null);
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = (text || "").trim();
      if (!trimmed || streaming) return;

      setError(null);
      setStreaming(true);

      const assistantMsg = makeOptimisticMessage("assistant");

      try {
        const convId = await ensureConversation();

        const userMsg = makeOptimisticMessage("user", {
          content: trimmed,
        });

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setStreamingId(assistantMsg.id);

        const controller = new AbortController();
        streamControllerRef.current = controller;

        await dfaApi.streamMessage(convId, trimmed, {
          signal: controller.signal,

          onDelta: (deltaText) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      content: `${m.content || ""}${deltaText || ""}`,
                    }
                  : m,
              ),
            );
          },

          onSkillOutput: (skillOutput) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      skill_outputs: [...(m.skill_outputs || []), skillOutput],
                    }
                  : m,
              ),
            );
          },

          onCitation: (citation) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      citations: [...(m.citations || []), citation],
                    }
                  : m,
              ),
            );
          },

          onDone: () => {
            setStreaming(false);
            setStreamingId(null);
            streamControllerRef.current = null;
            refreshConversations();
          },

          onError: (err) => {
            setError(err.message || "Failed to stream DFA response");
            setStreaming(false);
            setStreamingId(null);
            streamControllerRef.current = null;
          },
        });
      } catch (err) {
        setError(err.message || "Failed to send DFA message");
        setStreaming(false);
        setStreamingId(null);
        streamControllerRef.current = null;
      }
    },
    [ensureConversation, refreshConversations, streaming],
  );

  useEffect(() => {
    let alive = true;

    dfaApi
      .listConversations()
      .then((rows) => {
        if (alive) {
          setConversations(rows || []);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(err.message || "Failed to load DFA conversations");
        }
      });

    return () => {
      alive = false;
      streamControllerRef.current?.abort();
    };
  }, []);

  const value = useMemo(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,

      conversations,
      activeId,
      messages,

      streaming,
      streamingId,
      error,

      send,
      stopStreaming,
      loadConversation,
      newConversation,
      refreshConversations,
    }),
    [
      drawerOpen,
      openDrawer,
      closeDrawer,
      conversations,
      activeId,
      messages,
      streaming,
      streamingId,
      error,
      send,
      stopStreaming,
      loadConversation,
      newConversation,
      refreshConversations,
    ],
  );

  return <DfaContext.Provider value={value}>{children}</DfaContext.Provider>;
}
