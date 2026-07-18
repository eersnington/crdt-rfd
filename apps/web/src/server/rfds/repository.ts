import {
  CommittedRfdDocument,
  RfdId,
  RfdNumber,
  RfdOperationFailed,
  RfdSummary,
  UserId,
  parseRfdDocument,
  serializeRfdDocument,
  type CommittedRfdDocument as CommittedRfdDocumentValue,
  type CreateRfdInput,
  type CurrentUser,
  type RfdSummary as RfdSummaryValue,
} from "@crdt-rfd/domain";
import { env } from "cloudflare:workers";
import { Context, Data, Effect, Layer, Schema } from "effect";

import {
  createArtifactReadToken,
  createArtifactRepository,
  createArtifactWriteToken,
  listArtifactRepositories,
  waitForArtifactRepository,
} from "./artifacts";
import {
  allocateRfdNumber,
  cacheCommittedSource,
  getCatalogRecord,
  insertCatalogRecord,
  listCatalog,
  loadGithubLogin,
} from "./catalog-d1";
import { initializeRfdRepository, readRfdRepository } from "./git-ops";

export interface RfdRepositoryShape {
  readonly list: () => Effect.Effect<ReadonlyArray<RfdSummaryValue>, RfdOperationFailed>;
  readonly create: (
    input: CreateRfdInput,
    user: CurrentUser,
  ) => Effect.Effect<RfdSummaryValue, RfdOperationFailed>;
  readonly get: (
    rfdId: typeof RfdId.Type,
  ) => Effect.Effect<CommittedRfdDocumentValue, RfdOperationFailed>;
}

export class RfdRepository extends Context.Service<RfdRepository, RfdRepositoryShape>()(
  "RfdRepository",
) {}

class DatabaseOperationError extends Data.TaggedError("DatabaseOperationError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

const database = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new DatabaseOperationError({ operation, cause }),
  });

const failed = (operation: string, message: string) =>
  new RfdOperationFailed({ operation, message });

const describeError = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    if ("diagnostic" in error && typeof error.diagnostic === "string") return error.diagnostic;
    if ("operation" in error && typeof error.operation === "string") {
      const cause = "cause" in error ? describeError(error.cause) : "unknown cause";
      return `${error.operation}: ${cause}`;
    }
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === "string" ? error : "unknown provider failure";
};

const makeRepository = (): RfdRepositoryShape => ({
  list: Effect.fn("RfdRepository.list")(() =>
    database("list RFD catalog", () => listCatalog(env.DB)).pipe(
      Effect.tapError((error) => Effect.logError("RfdRepository.list failed", error)),
      Effect.mapError(() =>
        failed(
          "list RFD catalog",
          "The RFD catalog could not be loaded. Refresh the page to try again.",
        ),
      ),
    ),
  ),

  create: Effect.fn("RfdRepository.create")(function* (input, user) {
    const title = input.title.trim();
    if (title.length === 0 || title.length > 200) {
      return yield* Effect.fail(
        failed("validate RFD title", "RFD titles must contain 1 to 200 characters."),
      );
    }

    const metadata = yield* Effect.all({
      rfdId: Schema.decodeUnknownEffect(RfdId)(crypto.randomUUID()),
      ownerUserId: Schema.decodeUnknownEffect(UserId)(user.id),
      allocatedNumber: database("allocate RFD number", () => allocateRfdNumber(env.DB)),
      githubLogin: database("load GitHub account", () => loadGithubLogin(env.DB, user.id)),
    }).pipe(
      Effect.tapError((error) => Effect.logError("RfdRepository.create metadata failed", error)),
      Effect.mapError((error) =>
        failed(
          "prepare RFD metadata",
          `The RFD could not be prepared: ${describeError(error)}. No repository was created.`,
        ),
      ),
    );
    const number = yield* Schema.decodeUnknownEffect(RfdNumber)(metadata.allocatedNumber).pipe(
      Effect.mapError(() =>
        failed(
          "decode RFD number",
          "D1 allocated an invalid RFD number. No repository was created.",
        ),
      ),
    );
    const repoName = `rfd-${metadata.rfdId}`;
    const date = new Date().toISOString().slice(0, 10);
    const source = serializeRfdDocument({
      frontmatter: {
        number,
        title,
        status: "draft",
        authors: [`github:${metadata.githubLogin}`],
        created: date,
        updated: date,
        reviewers: [],
        supersedes: [],
        related: [],
      },
      body: `\n# ${title}\n`,
    });

    const artifact = yield* createArtifactRepository(env.ARTIFACTS, repoName).pipe(
      Effect.tapError((error) => Effect.logError("RfdRepository.create Artifact failed", error)),
      Effect.mapError((error) =>
        failed(
          "create Artifacts repository",
          `Cloudflare could not create ${repoName}: ${describeError(error)}.`,
        ),
      ),
    );

    yield* listArtifactRepositories(env.ARTIFACTS).pipe(
      Effect.tap((page) =>
        Effect.logInfo("RfdRepository.create Artifact confirmed").pipe(
          Effect.annotateLogs({
            repositoryName: repoName,
            remote: artifact.remote,
            visibleRepositories: JSON.stringify(page.repos),
          }),
        ),
      ),
      Effect.tapError((error) =>
        Effect.logWarning("RfdRepository.create could not list Artifacts", error),
      ),
      Effect.ignore,
    );

    const complete = Effect.gen(function* () {
      yield* waitForArtifactRepository(env.ARTIFACTS, repoName);
      const writeToken = yield* createArtifactWriteToken(env.ARTIFACTS, repoName);
      const headSha = yield* initializeRfdRepository({
        remote: artifact.remote,
        token: writeToken,
        source,
        authorName: user.name,
      });
      const timestamp = Date.now();
      yield* database("insert RFD catalog entry", () =>
        insertCatalogRecord(env.DB, {
          rfdId: metadata.rfdId,
          number,
          title,
          artifactRepoName: repoName,
          artifactRemote: artifact.remote,
          headSha,
          committedSource: source,
          ownerUserId: metadata.ownerUserId,
          timestamp,
        }).then(() => undefined),
      );
      return yield* Schema.decodeUnknownEffect(RfdSummary)({
        rfdId: metadata.rfdId,
        number,
        title,
        status: "draft",
        author: user.name,
        updated: new Date(timestamp).toISOString(),
        labels: [],
      });
    });

    return yield* complete.pipe(
      Effect.tapError((error) =>
        Effect.logError("RfdRepository.create completion failed", error).pipe(
          Effect.annotateLogs({ repositoryName: repoName, remote: artifact.remote }),
        ),
      ),
      Effect.mapError((error) =>
        failed(
          "complete RFD creation",
          `RFD creation failed for retained repository ${repoName}: ${describeError(error)}. The repository remains available in the crdt-rfd Artifacts namespace for inspection.`,
        ),
      ),
    );
  }),

  get: Effect.fn("RfdRepository.get")(function* (rfdId) {
    const record = yield* database("load RFD catalog record", () =>
      getCatalogRecord(env.DB, rfdId),
    ).pipe(
      Effect.mapError((error) =>
        failed("read RFD", `The RFD catalog record could not be loaded: ${describeError(error)}.`),
      ),
    );
    if (record === null) {
      return yield* Effect.fail(failed("read RFD", `RFD ${rfdId} was not found.`));
    }
    const checkout =
      record.committedSource === null
        ? yield* createArtifactReadToken(env.ARTIFACTS, record.artifactRepoName).pipe(
            Effect.mapError((error) =>
              failed(
                "read RFD",
                `A repository read token could not be issued: ${describeError(error)}.`,
              ),
            ),
            Effect.flatMap((token) => readRfdRepository({ remote: record.artifactRemote, token })),
            Effect.mapError((error) =>
              failed(
                "read RFD",
                `The committed repository could not be read: ${describeError(error)}.`,
              ),
            ),
            Effect.tap((loaded) =>
              database("cache committed RFD source", () =>
                cacheCommittedSource(env.DB, rfdId, loaded.headSha, loaded.source).then(
                  () => undefined,
                ),
              ).pipe(
                Effect.tapError((error) =>
                  Effect.logWarning("RfdRepository.get cache write failed", error),
                ),
                Effect.ignore,
              ),
            ),
          )
        : { source: record.committedSource, headSha: record.headSha };
    const parsed = yield* Effect.fromResult(parseRfdDocument(checkout.source)).pipe(
      Effect.mapError((error) => failed("read RFD", error.message)),
    );
    return yield* Schema.decodeUnknownEffect(CommittedRfdDocument)({
      rfdId,
      number: record.number,
      title: parsed.frontmatter.title,
      status: parsed.frontmatter.status,
      author: record.author,
      updated: record.updated,
      body: parsed.body,
      headSha: checkout.headSha,
    }).pipe(
      Effect.mapError(() =>
        failed("read RFD", "The committed RFD metadata is invalid and could not be displayed."),
      ),
    );
  }),
});

export const RfdRepositoryLive = Layer.succeed(RfdRepository, makeRepository());
