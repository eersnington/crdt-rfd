import {
  CommittedRfdDocument,
  RfdId,
  RfdOperationFailed,
  RfdSummary,
  UserId,
  parseRfdDocument,
  serializeRfdDocument,
  type CommittedRfdDocument as CommittedRfdDocumentValue,
  type CreateRfdInput,
  type CurrentUser,
  type RfdId as RfdIdValue,
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
        body: `\n# ${title}\n`,
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
    });

    return RfdRepository.of({ list, create, get });
  }),
);

const RfdInfrastructureLive = Layer.mergeAll(
  ArtifactStoreLive,
  RfdCatalogStoreLive,
  GitRepositoryLive,
);

export const RfdRepositoryLive = RfdRepositoryLayer.pipe(Layer.provide(RfdInfrastructureLive));
