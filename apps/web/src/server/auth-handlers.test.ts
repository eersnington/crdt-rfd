import { describe, expect, it, vi } from "vite-plus/test";
import { authHandlers } from "./auth-handlers.ts";

describe("Better Auth route handlers", () => {
  it.each(["GET", "POST"] as const)("forwards %s requests to Better Auth", async (method) => {
    const request = new Request("https://rfd.example/api/auth/session", { method });
    const response = new Response(null, { status: 204 });
    const handler = vi.fn(() => response);

    expect(authHandlers({ handler })[method]({ request })).toBe(response);
    expect(handler).toHaveBeenCalledWith(request);
  });
});
