import {
  CommittedRfdDocument,
  CheckpointConflict,
  CheckpointFailed,
  RfdId,
  RfdOperationFailed,
  RfdSummary,
  UserId,
  parseRfdDocument,
  canTransitionRfdStatus,
  serializeRfdDocument,
  type CommittedRfdDocument as CommittedRfdDocumentValue,
  type CheckpointResult as CheckpointResultValue,
  type CheckpointRfdInput,
  type CommitSha,
  type RfdCheckpoint,
  type CreateRfdInput,
  type CurrentUser,
  type RfdId as RfdIdValue,
  type RoomRole,
  type RfdSummary as RfdSummaryValue,
} from "@crdt-rfd/domain";
import { Clock, Context, Effect, Layer, Schema } from "effect";

import { ArtifactStore, ArtifactStoreLive } from "./artifacts";
import { RfdCatalogStore, RfdCatalogStoreLive } from "./catalog-d1";
import { GitRepository, GitRepositoryLive } from "./git-ops";

export interface RfdRepositoryShape {
  readonly list: () => Effect.Effect<ReadonlyArray<RfdSummaryValue>, RfdOperationFailed>;
  readonly create: (
    input: CreateRfdInput,
    user: CurrentUser,
  ) => Effect.Effect<RfdSummaryValue, RfdOperationFailed>;
  readonly get: (rfdId: RfdIdValue) => Effect.Effect<CommittedRfdDocumentValue, RfdOperationFailed>;
  readonly checkpoint: (
    input: CheckpointRfdInput,
    user: CurrentUser,
  ) => Effect.Effect<CheckpointResultValue, CheckpointConflict | CheckpointFailed>;
  readonly loadCommittedSource: (
    rfdId: RfdIdValue,
  ) => Effect.Effect<{ readonly source: string; readonly headSha: CommitSha }, RfdOperationFailed>;
  readonly getRoomRole: (
    rfdId: RfdIdValue,
    userId: typeof UserId.Type,
  ) => Effect.Effect<RoomRole | null, RfdOperationFailed>;
  readonly history: (
    rfdId: RfdIdValue,
  ) => Effect.Effect<ReadonlyArray<RfdCheckpoint>, RfdOperationFailed>;
}

export class RfdRepository extends Context.Service<RfdRepository, RfdRepositoryShape>()(
  "crdt-rfd/RfdRepository",
) {}

const failed = (operation: string, message: string) =>
  new RfdOperationFailed({ operation, message });

const logFailure = (message: string, annotations?: Record<string, unknown>) => (error: unknown) =>
  Effect.logError(message, error).pipe(
    annotations === undefined ? (effect) => effect : Effect.annotateLogs(annotations),
  );

const RfdRepositoryLayer = Layer.effect(
  RfdRepository,
  Effect.gen(function* () {
    const artifacts = yield* ArtifactStore;
    const catalog = yield* RfdCatalogStore;
    const git = yield* GitRepository;

    const list = Effect.fn("RfdRepository.list")(() =>
      catalog.list().pipe(
        Effect.tapError(logFailure("RfdRepository.list failed")),
        Effect.mapError(() =>
          failed(
            "list RFD catalog",
            "The RFD catalog could not be loaded. Refresh the page to try again.",
          ),
        ),
      ),
    );

    const create = Effect.fn("RfdRepository.create")(function* (
      input: CreateRfdInput,
      user: CurrentUser,
    ) {
      const title = input.title.trim();
      if (title.length === 0 || title.length > 200) {
        return yield* failed("validate RFD title", "RFD titles must contain 1 to 200 characters.");
      }

      const metadata = yield* Effect.all({
        rfdId: Schema.decodeUnknownEffect(RfdId)(crypto.randomUUID()),
        ownerUserId: Schema.decodeUnknownEffect(UserId)(user.id),
      }).pipe(
        Effect.tapError(logFailure("RfdRepository.create identity validation failed")),
        Effect.mapError(() =>
          failed(
            "prepare RFD identity",
            "The RFD could not be prepared because its identity was invalid. No repository was created.",
          ),
        ),
      );

      const githubLogin = yield* catalog.loadGithubLogin(metadata.ownerUserId).pipe(
        Effect.tapError(logFailure("RfdRepository.create GitHub account lookup failed")),
        Effect.mapError(() =>
          failed(
            "load GitHub account",
            "The signed-in account is not linked to GitHub. Sign in with GitHub and retry.",
          ),
        ),
      );
      const number = yield* catalog.allocateNumber().pipe(
        Effect.tapError(logFailure("RfdRepository.create number allocation failed")),
        Effect.mapError(() =>
          failed(
            "allocate RFD number",
            "An RFD number could not be reserved. No repository was created.",
          ),
        ),
      );

      const repositoryName = `rfd-${metadata.rfdId}`;
      const timestamp = yield* Clock.currentTimeMillis;
      const date = new Date(timestamp).toISOString().slice(0, 10);
      const source = serializeRfdDocument({
        frontmatter: {
          number,
          title,
          status: "draft",
          authors: [`github:${githubLogin}`],
          created: date,
          updated: date,
          reviewers: [],
          supersedes: [],
          related: [],
        },
        body: "",
      });

      const artifact = yield* artifacts.createRepository(repositoryName).pipe(
        Effect.tapError(
          logFailure("RfdRepository.create Artifact creation failed", { repositoryName }),
        ),
        Effect.mapError(() =>
          failed(
            "create Artifacts repository",
            "Cloudflare could not create the RFD repository. No repository was retained.",
          ),
        ),
      );

      const summary = yield* Effect.gen(function* () {
        yield* artifacts.waitUntilReady(repositoryName);
        const writeToken = yield* artifacts.createToken(repositoryName, "write");
        const headSha = yield* git.initialize({
          remote: artifact.remote,
          token: writeToken,
          source,
          authorName: user.name,
        });
        yield* catalog.insert({
          rfdId: metadata.rfdId,
          number,
          title,
          artifactRepoName: repositoryName,
          artifactRemote: artifact.remote,
          headSha,
          committedSource: source,
          ownerUserId: metadata.ownerUserId,
          timestamp,
        });
        return yield* Schema.decodeUnknownEffect(RfdSummary)({
          rfdId: metadata.rfdId,
          number,
          title,
          status: "draft",
          author: user.name,
          updated: new Date(timestamp).toISOString(),
          labels: [],
        });
      }).pipe(
        Effect.tapError(
          logFailure("RfdRepository.create completion failed", {
            repositoryName,
            remote: artifact.remote,
          }),
        ),
        Effect.mapError(() =>
          failed(
            "complete RFD creation",
            `RFD creation did not complete. Repository ${repositoryName} was retained for recovery.`,
          ),
        ),
      );

      return summary;
    });

    const get = Effect.fn("RfdRepository.get")(function* (rfdId: RfdIdValue) {
      const record = yield* catalog.getRecord(rfdId).pipe(
        Effect.tapError(logFailure("RfdRepository.get catalog lookup failed", { rfdId })),
        Effect.mapError(() =>
          failed(
            "read RFD",
            "The RFD catalog record could not be loaded. Refresh the page to try again.",
          ),
        ),
      );
      if (record === null) {
        return yield* failed("read RFD", `RFD ${rfdId} was not found.`);
      }

      const checkout =
        record.committedSource === null
          ? yield* artifacts.createToken(record.artifactRepoName, "read").pipe(
              Effect.flatMap((token) => git.read({ remote: record.artifactRemote, token })),
              Effect.tapError(
                logFailure("RfdRepository.get repository checkout failed", {
                  rfdId,
                  repositoryName: record.artifactRepoName,
                }),
              ),
              Effect.mapError(() =>
                failed(
                  "read RFD",
                  "The committed RFD could not be loaded. Refresh the page to try again.",
                ),
              ),
              Effect.tap((loaded) =>
                catalog
                  .cacheCommittedSource({
                    rfdId,
                    headSha: loaded.headSha,
                    committedSource: loaded.source,
                  })
                  .pipe(
                    Effect.tapError(logFailure("RfdRepository.get cache write failed", { rfdId })),
                    Effect.ignore,
                  ),
              ),
            )
          : { source: record.committedSource, headSha: record.headSha };

      const checkpointMessage =
        record.checkpointMessage ??
        (yield* artifacts.createToken(record.artifactRepoName, "read").pipe(
          Effect.flatMap((token) => git.history({ remote: record.artifactRemote, token })),
          Effect.flatMap((history) =>
            history[0] === undefined
              ? Effect.fail(failed("read RFD", "The RFD repository has no checkpoint history."))
              : Effect.succeed(history[0].message),
          ),
          Effect.tap((message) =>
            catalog
              .cacheCheckpointMessage({
                rfdId,
                headSha: checkout.headSha,
                checkpointMessage: message,
              })
              .pipe(
                Effect.tapError(
                  logFailure("RfdRepository.get checkpoint message cache write failed", { rfdId }),
                ),
                Effect.ignore,
              ),
          ),
          Effect.mapError(() =>
            failed(
              "read RFD checkpoint message",
              "The latest checkpoint message could not be loaded. Refresh the page to try again.",
            ),
          ),
        ));

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
        checkpointMessage,
      }).pipe(
        Effect.mapError(() =>
          failed("read RFD", "The committed RFD metadata is invalid and could not be displayed."),
        ),
      );
    });

    const loadCommittedSource = Effect.fn("RfdRepository.loadCommittedSource")(function* (
      rfdId: RfdIdValue,
    ) {
      const record = yield* catalog
        .getRecord(rfdId)
        .pipe(
          Effect.mapError(() =>
            failed("load committed RFD", "The RFD catalog could not be loaded."),
          ),
        );
      if (record === null)
        return yield* failed("load committed RFD", `RFD ${rfdId} was not found.`);
      if (record.committedSource !== null) {
        return { source: record.committedSource, headSha: record.headSha };
      }
      const token = yield* artifacts
        .createToken(record.artifactRepoName, "read")
        .pipe(
          Effect.mapError(() =>
            failed("load committed RFD", "A repository token could not be issued."),
          ),
        );
      return yield* git
        .read({ remote: record.artifactRemote, token })
        .pipe(
          Effect.mapError(() =>
            failed("load committed RFD", "The committed repository could not be read."),
          ),
        );
    });

    const checkpoint = Effect.fn("RfdRepository.checkpoint")(function* (
      input: CheckpointRfdInput,
      user: CurrentUser,
    ) {
      const record = yield* catalog
        .getRecord(input.rfdId)
        .pipe(
          Effect.mapError(
            () => new CheckpointFailed({ message: "The RFD catalog record could not be loaded." }),
          ),
        );
      if (record === null) {
        return yield* new CheckpointFailed({ message: `RFD ${input.rfdId} was not found.` });
      }
      const role = yield* catalog
        .getRoomRole(input.rfdId, user.id)
        .pipe(
          Effect.mapError(
            () =>
              new CheckpointFailed({ message: "Checkpoint authorization could not be verified." }),
          ),
        );
      if (role !== "owner" && role !== "editor") {
        return yield* new CheckpointFailed({ message: "Checkpoint permission was denied." });
      }
      const parsed = yield* Effect.fromResult(parseRfdDocument(input.source)).pipe(
        Effect.mapError(
          (error) => new CheckpointFailed({ message: `The draft is invalid: ${error.message}` }),
        ),
      );
      if (parsed.frontmatter.number !== record.number) {
        return yield* new CheckpointFailed({
          message: "The draft RFD number does not match the repository being checkpointed.",
        });
      }
      if (
        parsed.frontmatter.status !== record.status &&
        !canTransitionRfdStatus(record.status, parsed.frontmatter.status)
      ) {
        return yield* new CheckpointFailed({
          message: `RFD status cannot transition from ${record.status} to ${parsed.frontmatter.status}.`,
        });
      }
      const timestamp = yield* Clock.currentTimeMillis;
      const checkpointMessage = input.message ?? "Automatic checkpoint";
      const source = serializeRfdDocument({
        frontmatter: {
          ...parsed.frontmatter,
          updated: new Date(timestamp).toISOString().slice(0, 10),
        },
        body: parsed.body,
      });
      const token = yield* artifacts
        .createToken(record.artifactRepoName, "write")
        .pipe(
          Effect.mapError(
            () =>
              new CheckpointFailed({ message: "A repository write token could not be issued." }),
          ),
        );
      const committed = yield* git
        .checkpoint({
          remote: record.artifactRemote,
          token,
          source,
          authorName: user.name,
          expectedHeadSha: input.expectedHeadSha,
          message: checkpointMessage,
        })
        .pipe(
          Effect.mapError((error) =>
            error._tag === "GitCheckpointConflict"
              ? new CheckpointConflict({
                  expectedHeadSha: error.expectedHeadSha,
                  actualHeadSha: error.actualHeadSha,
                  message:
                    "The committed RFD changed while this draft was open. The draft was preserved.",
                })
              : new CheckpointFailed({
                  message: "The checkpoint could not be pushed. The draft was preserved.",
                }),
          ),
        );
      yield* catalog
        .commitCheckpoint({
          rfdId: input.rfdId,
          expectedHeadSha: committed.previousHeadSha,
          nextHeadSha: committed.headSha,
          title: parsed.frontmatter.title,
          status: parsed.frontmatter.status,
          committedSource: source,
          checkpointMessage,
          timestamp,
        })
        .pipe(
          Effect.mapError(
            () =>
              new CheckpointFailed({
                message:
                  "The checkpoint was committed, but the catalog could not be synchronized. The Git commit is preserved; reopen the RFD to recover it.",
              }),
          ),
        );
      return {
        rfdId: input.rfdId,
        previousHeadSha: committed.previousHeadSha,
        headSha: committed.headSha,
      };
    });

    const getRoomRole = Effect.fn("RfdRepository.getRoomRole")((rfdId, userId) =>
      catalog
        .getRoomRole(rfdId, userId)
        .pipe(
          Effect.mapError(() =>
            failed("authorize RFD room", "The RFD room membership could not be loaded."),
          ),
        ),
    );

    const history = Effect.fn("RfdRepository.history")(function* (rfdId: RfdIdValue) {
      const record = yield* catalog
        .getRecord(rfdId)
        .pipe(
          Effect.mapError(() => failed("read RFD history", "The RFD catalog could not be loaded.")),
        );
      if (record === null) return yield* failed("read RFD history", `RFD ${rfdId} was not found.`);
      const token = yield* artifacts
        .createToken(record.artifactRepoName, "read")
        .pipe(
          Effect.mapError(() =>
            failed("read RFD history", "A repository token could not be issued."),
          ),
        );
      return yield* git
        .history({ remote: record.artifactRemote, token })
        .pipe(
          Effect.mapError(() => failed("read RFD history", "The Git history could not be loaded.")),
        );
    });

    return RfdRepository.of({
      list,
      create,
      get,
      loadCommittedSource,
      checkpoint,
      getRoomRole,
      history,
    });
  }),
);

const RfdInfrastructureLive = Layer.mergeAll(
  ArtifactStoreLive,
  RfdCatalogStoreLive,
  GitRepositoryLive,
);

export const RfdRepositoryLive = RfdRepositoryLayer.pipe(Layer.provide(RfdInfrastructureLive));
