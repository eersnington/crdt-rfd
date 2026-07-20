import { CommitSha, type CommitSha as CommitShaValue, type RfdCheckpoint } from "@crdt-rfd/domain";
import { Context, Effect, Layer, Result, Schema } from "effect";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";

import { MemoryFS } from "./memory-fs";

const directory = "/workspace";
const historyDepth = 20;
const credentials = (token: string) => () => ({ username: "x", password: token });

export class GitInitializationFailed extends Schema.TaggedErrorClass<GitInitializationFailed>()(
  "GitInitializationFailed",
  { stage: Schema.String, diagnostic: Schema.String },
) {}

export class GitReadFailed extends Schema.TaggedErrorClass<GitReadFailed>()("GitReadFailed", {
  stage: Schema.String,
  diagnostic: Schema.String,
}) {}

export class GitCheckpointConflict extends Schema.TaggedErrorClass<GitCheckpointConflict>()(
  "GitCheckpointConflict",
  { expectedHeadSha: CommitSha, actualHeadSha: CommitSha },
) {}

export class GitCheckpointFailed extends Schema.TaggedErrorClass<GitCheckpointFailed>()(
  "GitCheckpointFailed",
  { stage: Schema.String, diagnostic: Schema.String },
) {}

const diagnostic = (cause: unknown): string => {
  try {
    if (!(cause instanceof Error)) return String(cause).slice(0, 1_000);
    const details = cause as Error & {
      readonly caller?: unknown;
      readonly code?: unknown;
      readonly statusCode?: unknown;
    };
    const field = (value: unknown) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "[complex value]";
    return [
      details.name,
      details.message,
      details.code === undefined ? undefined : `code=${field(details.code)}`,
      details.statusCode === undefined ? undefined : `status=${field(details.statusCode)}`,
      details.caller === undefined ? undefined : `caller=${field(details.caller)}`,
    ]
      .filter((part) => part !== undefined)
      .join("; ")
      .replace(/art_v1_[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
      .replace(/(authorization["']?\s*[:=]\s*["']?)[^,;"']+/gi, "$1[REDACTED]")
      .slice(0, 1_000);
  } catch {
    return "Provider failure could not be safely formatted.";
  }
};

export interface GitRepositoryShape {
  readonly initialize: (options: {
    readonly remote: string;
    readonly token: string;
    readonly source: string;
    readonly authorName: string;
  }) => Effect.Effect<CommitShaValue, GitInitializationFailed>;
  readonly read: (options: {
    readonly remote: string;
    readonly token: string;
  }) => Effect.Effect<{ readonly source: string; readonly headSha: CommitShaValue }, GitReadFailed>;
  readonly checkpoint: (options: {
    readonly remote: string;
    readonly token: string;
    readonly source: string;
    readonly authorName: string;
    readonly expectedHeadSha: CommitShaValue;
    readonly message?: string;
  }) => Effect.Effect<
    { readonly previousHeadSha: CommitShaValue; readonly headSha: CommitShaValue },
    GitCheckpointConflict | GitCheckpointFailed
  >;
  readonly history: (options: {
    readonly remote: string;
    readonly token: string;
  }) => Effect.Effect<ReadonlyArray<RfdCheckpoint>, GitReadFailed>;
}

export class GitRepository extends Context.Service<GitRepository, GitRepositoryShape>()(
  "crdt-rfd/GitRepository",
) {}

const initializationFailure = (stage: string) => (cause: unknown) =>
  new GitInitializationFailed({ stage, diagnostic: diagnostic(cause) });

const readFailure = (stage: string) => (cause: unknown) =>
  new GitReadFailed({ stage, diagnostic: diagnostic(cause) });

const checkpointFailure = (stage: string) => (cause: unknown) =>
  new GitCheckpointFailed({ stage, diagnostic: diagnostic(cause) });

export const GitRepositoryLive = Layer.succeed(
  GitRepository,
  GitRepository.of({
    initialize: Effect.fn("GitRepository.initialize")(function* (options) {
      const fs = new MemoryFS();
      yield* Effect.tryPromise({
        try: () => git.init({ fs, dir: directory, defaultBranch: "main" }),
        catch: initializationFailure("initialize repository"),
      });
      yield* Effect.tryPromise({
        try: () => fs.promises.writeFile(`${directory}/rfd.md`, options.source),
        catch: initializationFailure("write rfd.md"),
      });
      yield* Effect.tryPromise({
        try: () => git.add({ fs, dir: directory, filepath: "rfd.md" }),
        catch: initializationFailure("stage rfd.md"),
      });
      const sha = yield* Effect.tryPromise({
        try: () =>
          git.commit({
            fs,
            dir: directory,
            message: "Create RFD",
            author: { name: options.authorName, email: "rfd@crdt-rfd.invalid" },
          }),
        catch: initializationFailure("create initial commit"),
      });
      yield* Effect.tryPromise({
        try: () =>
          git.push({
            fs,
            http,
            dir: directory,
            url: options.remote,
            ref: "main",
            onAuth: credentials(options.token),
            onAuthFailure: credentials(options.token),
          }),
        catch: initializationFailure("push initial commit"),
      });
      return yield* Schema.decodeUnknownEffect(CommitSha)(sha).pipe(
        Effect.mapError(initializationFailure("decode commit SHA")),
      );
    }),
    read: Effect.fn("GitRepository.read")(function* (options) {
      const fs = new MemoryFS();
      yield* Effect.tryPromise({
        try: () =>
          git.clone({
            fs,
            http,
            dir: directory,
            url: options.remote,
            ref: "main",
            singleBranch: true,
            depth: 1,
            onAuth: credentials(options.token),
            onAuthFailure: credentials(options.token),
          }),
        catch: readFailure("clone repository"),
      });
      const source = yield* Effect.tryPromise({
        try: () => fs.promises.readFile(`${directory}/rfd.md`, "utf8"),
        catch: readFailure("read rfd.md"),
      });
      const sha = yield* Effect.tryPromise({
        try: () => git.resolveRef({ fs, dir: directory, ref: "HEAD" }),
        catch: readFailure("resolve repository head"),
      });
      const headSha = yield* Schema.decodeUnknownEffect(CommitSha)(sha).pipe(
        Effect.mapError(readFailure("decode repository head")),
      );
      return { source: String(source), headSha };
    }),
    checkpoint: Effect.fn("GitRepository.checkpoint")(function* (options) {
      const fs = new MemoryFS();
      yield* Effect.tryPromise({
        try: () =>
          git.clone({
            fs,
            http,
            dir: directory,
            url: options.remote,
            ref: "main",
            singleBranch: true,
            depth: 1,
            onAuth: credentials(options.token),
            onAuthFailure: credentials(options.token),
          }),
        catch: checkpointFailure("clone repository"),
      });
      const resolved = yield* Effect.tryPromise({
        try: () => git.resolveRef({ fs, dir: directory, ref: "HEAD" }),
        catch: checkpointFailure("resolve repository head"),
      });
      const previousHeadSha = yield* Schema.decodeUnknownEffect(CommitSha)(resolved).pipe(
        Effect.mapError(checkpointFailure("decode repository head")),
      );
      if (previousHeadSha !== options.expectedHeadSha) {
        return yield* new GitCheckpointConflict({
          expectedHeadSha: options.expectedHeadSha,
          actualHeadSha: previousHeadSha,
        });
      }
      yield* Effect.tryPromise({
        try: () => fs.promises.writeFile(`${directory}/rfd.md`, options.source),
        catch: checkpointFailure("write rfd.md"),
      });
      yield* Effect.tryPromise({
        try: () => git.add({ fs, dir: directory, filepath: "rfd.md" }),
        catch: checkpointFailure("stage rfd.md"),
      });
      const committed = yield* Effect.tryPromise({
        try: () =>
          git.commit({
            fs,
            dir: directory,
            message: options.message ?? "Automatic checkpoint",
            author: { name: options.authorName, email: "rfd@crdt-rfd.invalid" },
          }),
        catch: checkpointFailure("create checkpoint commit"),
      });
      const headSha = yield* Schema.decodeUnknownEffect(CommitSha)(committed).pipe(
        Effect.mapError(checkpointFailure("decode checkpoint SHA")),
      );
      const pushed = yield* Effect.result(
        Effect.tryPromise({
          try: () =>
            git.push({
              fs,
              http,
              dir: directory,
              url: options.remote,
              ref: "main",
              onAuth: credentials(options.token),
              onAuthFailure: credentials(options.token),
            }),
          catch: checkpointFailure("push checkpoint commit"),
        }),
      );
      if (Result.isFailure(pushed)) {
        const remoteFs = new MemoryFS();
        const actualHeadSha = yield* Effect.tryPromise({
          try: async () => {
            await git.clone({
              fs: remoteFs,
              http,
              dir: directory,
              url: options.remote,
              ref: "main",
              singleBranch: true,
              depth: 1,
              onAuth: credentials(options.token),
              onAuthFailure: credentials(options.token),
            });
            return git.resolveRef({ fs: remoteFs, dir: directory, ref: "HEAD" });
          },
          catch: checkpointFailure("resolve head after rejected push"),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CommitSha)),
          Effect.mapError(checkpointFailure("decode head after rejected push")),
        );
        if (actualHeadSha !== options.expectedHeadSha) {
          return yield* new GitCheckpointConflict({
            expectedHeadSha: options.expectedHeadSha,
            actualHeadSha,
          });
        }
        return yield* pushed.failure;
      }
      return { previousHeadSha, headSha };
    }),
    history: Effect.fn("GitRepository.history")(function* (options) {
      const fs = new MemoryFS();
      yield* Effect.tryPromise({
        try: () =>
          git.clone({
            fs,
            http,
            dir: directory,
            url: options.remote,
            ref: "main",
            singleBranch: true,
            depth: historyDepth,
            onAuth: credentials(options.token),
            onAuthFailure: credentials(options.token),
          }),
        catch: readFailure("clone repository history"),
      });
      const commits = yield* Effect.tryPromise({
        try: () => git.log({ fs, dir: directory, depth: historyDepth }),
        catch: readFailure("read repository history"),
      });
      return yield* Effect.forEach(commits, (commit) =>
        Schema.decodeUnknownEffect(CommitSha)(commit.oid).pipe(
          Effect.map((sha) => ({
            sha,
            message: commit.commit.message.split("\n")[0] ?? "Checkpoint",
            author: commit.commit.author.name,
            createdAt: new Date(commit.commit.author.timestamp * 1_000).toISOString(),
          })),
          Effect.mapError(readFailure("decode history commit")),
        ),
      );
    }),
  }),
);
