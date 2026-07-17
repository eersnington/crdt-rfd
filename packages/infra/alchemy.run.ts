import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const RfdDatabase = Cloudflare.D1.Database("RfdDatabase", {
  migrationsDir: "./migrations",
});

export const RfdBucket = Cloudflare.R2.Bucket("RfdBucket");

const AppOrigin = Config.schema(Schema.URLFromString, "APP_ORIGIN");

export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  rootDir: "../../apps/web",
  domain: AppOrigin.pipe(Config.map((url) => url.hostname)),
  dev: {
    port: 6767,
    strictPort: true,
  },
  compatibility: {
    flags: ["nodejs_compat"],
  },
  assets: {
    notFoundHandling: "404-page",
    runWorkerFirst: false,
  },
  env: {
    DB: RfdDatabase,
    GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
    GITHUB_CLIENT_SECRET: Config.redacted("GITHUB_CLIENT_SECRET"),
    APP_ORIGIN: AppOrigin.pipe(Config.map((url) => url.origin)),
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
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
    const bucket = yield* RfdBucket;
    const database = yield* RfdDatabase;
    const website = yield* Website;

    return {
      bucketName: bucket.bucketName,
      databaseName: database.databaseName,
      websiteUrl: website.url.as<string>(),
    };
  }),
);
