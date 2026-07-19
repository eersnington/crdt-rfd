import type { WebsiteEnv } from "../../../../../packages/infra/alchemy.run";
import { Context, Effect, Layer, Schedule, Schema } from "effect";

import { cloudflareEnv } from "../env";

type ArtifactsBinding = WebsiteEnv["ARTIFACTS"];
type CreatedRepository = Awaited<ReturnType<ArtifactsBinding["create"]>>;
type RepositoryHandle = Awaited<ReturnType<ArtifactsBinding["get"]>>;
type CreatedToken = Awaited<ReturnType<RepositoryHandle["createToken"]>>;

export class ArtifactRepositoryCreationFailed extends Schema.TaggedErrorClass<ArtifactRepositoryCreationFailed>()(
  "ArtifactRepositoryCreationFailed",
  { repositoryName: Schema.String, cause: Schema.Defect() },
) {}

export class ArtifactRepositoryUnavailable extends Schema.TaggedErrorClass<ArtifactRepositoryUnavailable>()(
  "ArtifactRepositoryUnavailable",
  { repositoryName: Schema.String, cause: Schema.Defect() },
) {}

export class ArtifactTokenCreationFailed extends Schema.TaggedErrorClass<ArtifactTokenCreationFailed>()(
  "ArtifactTokenCreationFailed",
  {
    repositoryName: Schema.String,
    permission: Schema.Literals(["read", "write"]),
    cause: Schema.Defect(),
  },
) {}

type ArtifactStoreError =
  | ArtifactRepositoryCreationFailed
  | ArtifactRepositoryUnavailable
  | ArtifactTokenCreationFailed;

export interface ArtifactStoreShape {
  readonly createRepository: (
    repositoryName: string,
  ) => Effect.Effect<{ readonly remote: string }, ArtifactRepositoryCreationFailed>;
  readonly waitUntilReady: (
    repositoryName: string,
  ) => Effect.Effect<void, ArtifactRepositoryUnavailable>;
  readonly createToken: (
    repositoryName: string,
    permission: "read" | "write",
  ) => Effect.Effect<string, ArtifactTokenCreationFailed>;
}

export class ArtifactStore extends Context.Service<ArtifactStore, ArtifactStoreShape>()(
  "crdt-rfd/ArtifactStore",
) {}

const tokenSecret = (token: string) => token.split("?expires=")[0] ?? token;

const readinessSchedule = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(6)),
);

export const makeArtifactStore = (artifacts: ArtifactsBinding): ArtifactStoreShape => {
  const createRepository = Effect.fn("ArtifactStore.createRepository")((repositoryName: string) =>
    Effect.tryPromise({
      try: (): Promise<CreatedRepository> =>
        artifacts.create(repositoryName, {
          description: "Request for Discussion",
          setDefaultBranch: "main",
        }),
      catch: (cause) => new ArtifactRepositoryCreationFailed({ repositoryName, cause }),
    }).pipe(Effect.map(({ remote }) => ({ remote }))),
  );

  const getRepository = (
    repositoryName: string,
  ): Effect.Effect<RepositoryHandle, ArtifactRepositoryUnavailable> =>
    Effect.tryPromise({
      try: (): Promise<RepositoryHandle> => artifacts.get(repositoryName),
      catch: (cause) => new ArtifactRepositoryUnavailable({ repositoryName, cause }),
    });

  const waitUntilReady = Effect.fn("ArtifactStore.waitUntilReady")((repositoryName: string) =>
    getRepository(repositoryName).pipe(Effect.retry(readinessSchedule), Effect.asVoid),
  );

  const createToken = Effect.fn("ArtifactStore.createToken")(function* (
    repositoryName: string,
    permission: "read" | "write",
  ) {
    const repository = yield* getRepository(repositoryName).pipe(
      Effect.mapError(
        (error) =>
          new ArtifactTokenCreationFailed({
            repositoryName,
            permission,
            cause: error.cause,
          }),
      ),
    );
    const token = yield* Effect.tryPromise({
      try: (): Promise<CreatedToken> => repository.createToken(permission, 300),
      catch: (cause) => new ArtifactTokenCreationFailed({ repositoryName, permission, cause }),
    });
    return tokenSecret(token.plaintext);
  });

  return ArtifactStore.of({ createRepository, waitUntilReady, createToken });
};

export const ArtifactStoreLive = Layer.sync(ArtifactStore, () =>
  makeArtifactStore(cloudflareEnv.ARTIFACTS),
);

export type { ArtifactStoreError };
