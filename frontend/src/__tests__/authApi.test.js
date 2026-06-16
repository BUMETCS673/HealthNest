import { authApi } from "../lib/authApi";

describe("authApi WebAuthn encoding helpers", () => {
  test("converts an ArrayBuffer to unpadded Base64URL", () => {
    expect(authApi._bufferToB64(Uint8Array.from([251]).buffer)).toBe("-w");
    expect(authApi._bufferToB64(Uint8Array.from([255]).buffer)).toBe("_w");
  });
});
