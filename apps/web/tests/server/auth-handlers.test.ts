import { describe, expect, it, vi } from "vite-plus/test";

import { authHandlers } from "../../src/server/auth-handlers";

describe("auth handlers", () => {
  it("rejects token-based session management paths that cannot use stored digests", async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const handlers = authHandlers({ handler });

    for (const path of ["list-sessions", "revoke-session", "revoke-other-sessions"]) {
      const response = await handlers.GET({
        request: new Request(`http://localhost/api/auth/${path}`),
      });
      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toMatchObject({
        code: "SESSION_MANAGEMENT_UNAVAILABLE",
      });
    }
    expect(handler).not.toHaveBeenCalled();
  });
});
