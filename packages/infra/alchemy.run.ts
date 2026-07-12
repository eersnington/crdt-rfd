import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export const FoundationDatabase = Cloudflare.D1.Database("FoundationDatabase", {
  migrationsDir: "./migrations",
});

export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  rootDir: "../../apps/web",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  assets: {
    runWorkerFirst: true,
  },
  env: {
    DB: FoundationDatabase,
    GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
    GITHUB_CLIENT_SECRET: Config.redacted("GITHUB_CLIENT_SECRET"),
    APP_ORIGIN: Config.string("APP_ORIGIN"),
  },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "CrdtRfd",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.Bucket("FoundationBucket");
    const database = yield* FoundationDatabase;
    const website = yield* Website;

    return {
      bucketName: bucket.bucketName,
      databaseName: database.databaseName,
      websiteUrl: website.url.as<string>(),
    };
  }),
);
