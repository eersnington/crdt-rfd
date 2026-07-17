import {
  CurrentSession,
  SessionUnavailable,
  type CurrentSession as CurrentSessionValue,
} from "@crdt-rfd/domain";
import { Context, Effect, Schema } from "effect";

export interface SessionServiceShape {
  readonly getCurrent: (
    headers: globalThis.Headers,
  ) => Effect.Effect<CurrentSessionValue | null, SessionUnavailable>;
}

export class SessionService extends Context.Service<SessionService, SessionServiceShape>()(
  "SessionService",
) {}

export interface AuthSessionValue {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly image?: string | null | undefined;
  };
  readonly session: {
    readonly expiresAt: Date;
  };
}

export const makeSessionService = (
  loadSession: (headers: globalThis.Headers) => Promise<AuthSessionValue | null>,
): SessionServiceShape => ({
  getCurrent: Effect.fn("SessionService.getCurrent")((headers: globalThis.Headers) =>
    Effect.tryPromise({
      try: () => loadSession(headers),
      catch: (cause) => cause,
    }).pipe(
      Effect.tapError((cause) => Effect.logError("Better Auth session lookup failed", cause)),
      Effect.mapError(
        () =>
          new SessionUnavailable({
            operation: "load Better Auth session",
            message: "The current session could not be loaded. Refresh the page or sign in again.",
          }),
      ),
      Effect.flatMap((session) => {
        if (session === null) return Effect.succeed(null);
        return Schema.decodeUnknownEffect(CurrentSession)({
          user: {
            id: session.user.id,
            name: session.user.name,
            image: session.user.image ?? null,
          },
          expiresAt: session.session.expiresAt,
        }).pipe(
          Effect.tapError((cause) =>
            Effect.logError("Better Auth returned an invalid session value", cause),
          ),
          Effect.mapError(
            () =>
              new SessionUnavailable({
                operation: "decode Better Auth session",
                message: "The stored session is invalid. Sign in again to create a new session.",
              }),
          ),
        );
      }),
    ),
  ),
});
