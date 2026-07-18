import { CommitSha, type CommitSha as CommitShaValue } from "@crdt-rfd/domain";
import { Data, Effect, Schema } from "effect";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";

import { MemoryFS } from "./memory-fs";

const directory = "/workspace";
const credentials = (token: string) => () => ({ username: "x", password: token });

export class GitOperationError extends Data.TaggedError("GitOperationError")<{
  readonly operation: string;
  readonly diagnostic: string;
  readonly cause: unknown;
}> {}

const diagnosticValue = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
};

const diagnostic = (cause: unknown) => {
  if (!(cause instanceof Error)) return diagnosticValue(cause);
  const details = cause as Error & {
    readonly caller?: unknown;
    readonly code?: unknown;
    readonly data?: unknown;
    readonly statusCode?: unknown;
  };
  return [
    details.name,
    details.message,
    details.code === undefined ? undefined : `code=${diagnosticValue(details.code)}`,
    details.statusCode === undefined ? undefined : `status=${diagnosticValue(details.statusCode)}`,
    details.caller === undefined ? undefined : `caller=${diagnosticValue(details.caller)}`,
    details.data === undefined ? undefined : `data=${JSON.stringify(details.data)}`,
  ]
    .filter((part) => part !== undefined)
    .join("; ")
    .replace(/art_v1_[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
    .slice(0, 1_000);
};

const attempt = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new GitOperationError({ operation, diagnostic: diagnostic(cause), cause }),
  });

export const initializeRfdRepository = Effect.fn("Git.initializeRfdRepository")(
  function* (options: {
    readonly remote: string;
    readonly token: string;
    readonly source: string;
    readonly authorName: string;
  }) {
    const fs = new MemoryFS();
    yield* attempt("initialize in-memory repository", () =>
      git.init({ fs, dir: directory, defaultBranch: "main" }),
    );
    yield* attempt("write rfd.md", () =>
      fs.promises.writeFile(`${directory}/rfd.md`, options.source),
    );
    yield* attempt("stage rfd.md", () => git.add({ fs, dir: directory, filepath: "rfd.md" }));
    const sha = yield* attempt("create initial commit", () =>
      git.commit({
        fs,
        dir: directory,
        message: "Create RFD",
        author: { name: options.authorName, email: "rfd@crdt-rfd.invalid" },
      }),
    );
    yield* attempt("push initial commit", () =>
      git.push({
        fs,
        http,
        dir: directory,
        url: options.remote,
        ref: "main",
        onAuth: credentials(options.token),
        onAuthFailure: credentials(options.token),
      }),
    );
    return yield* Schema.decodeUnknownEffect(CommitSha)(sha);
  },
);

export const readRfdRepository = Effect.fn("Git.readRfdRepository")(function* (options: {
  readonly remote: string;
  readonly token: string;
}): Effect.fn.Return<
  { readonly source: string; readonly headSha: CommitShaValue },
  GitOperationError
> {
  const fs = new MemoryFS();
  yield* attempt("clone repository", () =>
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
  );
  const source = yield* attempt("read rfd.md", () =>
    fs.promises.readFile(`${directory}/rfd.md`, "utf8"),
  );
  const headSha = yield* attempt("resolve repository head", () =>
    git.resolveRef({ fs, dir: directory, ref: "HEAD" }),
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(CommitSha)),
    Effect.mapError((cause) =>
      cause instanceof GitOperationError
        ? cause
        : new GitOperationError({
            operation: "decode repository head",
            diagnostic: diagnostic(cause),
            cause,
          }),
    ),
  );
  return { source: String(source), headSha };
});
