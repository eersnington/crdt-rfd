import type { WebsiteEnv } from "../../../../../packages/infra/alchemy.run";
import { Data, Effect, Schedule } from "effect";

type ArtifactsBinding = WebsiteEnv["ARTIFACTS"];
type CreatedRepository = Awaited<ReturnType<ArtifactsBinding["create"]>>;
type RepositoryHandle = Awaited<ReturnType<ArtifactsBinding["get"]>>;
type RepositoryList = Awaited<ReturnType<ArtifactsBinding["list"]>>;
type CreatedToken = Awaited<ReturnType<RepositoryHandle["createToken"]>>;

export class ArtifactOperationError extends Data.TaggedError("ArtifactOperationError")<{
  readonly operation: string;
  readonly repositoryName: string;
  readonly cause: unknown;
}> {}

const tokenSecret = (token: string) => token.split("?expires=")[0] ?? token;

const attempt = <A>(
  operation: string,
  repositoryName: string,
  run: () => Promise<A>,
): Effect.Effect<A, ArtifactOperationError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ArtifactOperationError({ operation, repositoryName, cause }),
  });

export const createArtifactRepository = Effect.fn("Artifacts.createRepository")(
  (artifacts: ArtifactsBinding, name: string) =>
    attempt<CreatedRepository>("create repository", name, () =>
      artifacts.create(name, {
        description: "Request for Discussion",
        setDefaultBranch: "main",
      }),
    ).pipe(Effect.map((created) => ({ remote: created.remote }))),
);

export const createArtifactReadToken = Effect.fn("Artifacts.createReadToken")(
  (artifacts: ArtifactsBinding, name: string) =>
    attempt<RepositoryHandle>("get repository for read token", name, () =>
      artifacts.get(name),
    ).pipe(
      Effect.flatMap((repository) =>
        attempt<CreatedToken>("create read token", name, () => repository.createToken("read", 300)),
      ),
      Effect.map((token) => tokenSecret(token.plaintext)),
    ),
);

export const createArtifactWriteToken = Effect.fn("Artifacts.createWriteToken")(
  (artifacts: ArtifactsBinding, name: string) =>
    attempt<RepositoryHandle>("get repository for write token", name, () =>
      artifacts.get(name),
    ).pipe(
      Effect.flatMap((repository) =>
        attempt<CreatedToken>("create write token", name, () =>
          repository.createToken("write", 300),
        ),
      ),
      Effect.map((token) => tokenSecret(token.plaintext)),
    ),
);

const readinessSchedule = Schedule.exponential("100 millis").pipe(
  Schedule.both(Schedule.recurs(6)),
);

export const waitForArtifactRepository = Effect.fn("Artifacts.waitForRepository")(
  (artifacts: ArtifactsBinding, name: string) =>
    attempt<RepositoryHandle>("wait for repository readiness", name, () =>
      artifacts.get(name),
    ).pipe(Effect.retry(readinessSchedule), Effect.asVoid),
);

export const listArtifactRepositories = Effect.fn("Artifacts.listRepositories")(
  (artifacts: ArtifactsBinding) =>
    attempt<RepositoryList>("list repositories", "*", () => artifacts.list({ limit: 10 })),
);
