import { Context, Effect, Layer, Ref } from "effect";
import { randomToken, sha256 } from "./crypto.ts";
import { SessionStoreError } from "./errors.ts";

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly rotatedAt?: number;
}

export interface SessionStoreShape {
  readonly create: (session: Session) => Effect.Effect<void, SessionStoreError>;
  readonly findByTokenHash: (hash: string) => Effect.Effect<Session | undefined, SessionStoreError>;
  readonly deleteByTokenHash: (hash: string) => Effect.Effect<void, SessionStoreError>;
  readonly rotate: (oldHash: string, session: Session) => Effect.Effect<boolean, SessionStoreError>;
}

export class SessionStore extends Context.Service<SessionStore, SessionStoreShape>()(
  "crdt-rfd/SessionStore",
) {}

export interface IssuedSession {
  readonly token: string;
  readonly session: Session;
}

export const issueSession = (input: {
  readonly userId: string;
  readonly now: number;
  readonly ttlMs: number;
}) =>
  Effect.gen(function* () {
    const store = yield* SessionStore;
    const token = randomToken();
    const session: Session = {
      id: crypto.randomUUID(),
      userId: input.userId,
      tokenHash: yield* Effect.promise(() => sha256(token)),
      createdAt: input.now,
      expiresAt: input.now + input.ttlMs,
    };
    yield* store.create(session);
    return { token, session } satisfies IssuedSession;
  });

export const readSession = (token: string, now: number) =>
  Effect.gen(function* () {
    const store = yield* SessionStore;
    const hash = yield* Effect.promise(() => sha256(token));
    const session = yield* store.findByTokenHash(hash);
    if (session === undefined) return undefined;
    if (session.expiresAt <= now) {
      yield* store.deleteByTokenHash(hash);
      return undefined;
    }
    return session;
  });

export const logoutSession = (token: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore;
    yield* store.deleteByTokenHash(yield* Effect.promise(() => sha256(token)));
  });

export const rotateSession = (token: string, now: number, ttlMs: number) =>
  Effect.gen(function* () {
    const store = yield* SessionStore;
    const oldHash = yield* Effect.promise(() => sha256(token));
    const current = yield* store.findByTokenHash(oldHash);
    if (current === undefined || current.expiresAt <= now) {
      yield* store.deleteByTokenHash(oldHash);
      return undefined;
    }
    const nextToken = randomToken();
    const nextSession: Session = {
      id: crypto.randomUUID(),
      userId: current.userId,
      tokenHash: yield* Effect.promise(() => sha256(nextToken)),
      createdAt: now,
      expiresAt: now + ttlMs,
      rotatedAt: now,
    };
    if (!(yield* store.rotate(oldHash, nextSession))) return undefined;
    return { token: nextToken, session: nextSession } satisfies IssuedSession;
  });

export const inMemorySessionStoreLayer = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    const sessions = yield* Ref.make(new Map<string, Session>());
    return {
      create: (session) =>
        Ref.update(sessions, (current) => new Map(current).set(session.tokenHash, session)),
      findByTokenHash: (hash) => Ref.get(sessions).pipe(Effect.map((current) => current.get(hash))),
      deleteByTokenHash: (hash) =>
        Ref.update(sessions, (current) => {
          const next = new Map(current);
          next.delete(hash);
          return next;
        }),
      rotate: (oldHash, session) =>
        Ref.modify(sessions, (current) => {
          if (!current.has(oldHash)) return [false, current];
          const next = new Map(current);
          next.delete(oldHash);
          next.set(session.tokenHash, session);
          return [true, next];
        }),
    } satisfies SessionStoreShape;
  }),
);
