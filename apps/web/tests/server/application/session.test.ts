import { describe, expect, it } from "vite-plus/test";
import { Effect, Result } from "effect";

import { makeSessionService } from "../../../src/server/application/session";

describe("SessionService", () => {
  it("maps a Better Auth session to the stable application contract", async () => {
    const expiresAt = new Date("2026-08-01T00:00:00.000Z");
    const service = makeSessionService(async () => ({
      user: { id: "user_1", name: "Ada", image: null },
      session: { expiresAt },
    }));

    const session = await Effect.runPromise(service.getCurrent(new Headers()));

    expect(session).toEqual({
      user: { id: "user_1", name: "Ada", image: null },
      expiresAt,
    });
  });

  it("returns a structured error when Better Auth fails", async () => {
    const service = makeSessionService(async () => {
      throw new Error("D1 is unavailable");
    });

    const result = await Effect.runPromise(Effect.result(service.getCurrent(new Headers())));

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("SessionUnavailable");
      expect(result.failure.operation).toBe("load Better Auth session");
      expect(result.failure.message).toBe(
        "The current session could not be loaded. Refresh the page or sign in again.",
      );
    }
  });
});
