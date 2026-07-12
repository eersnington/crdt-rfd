import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export class Website extends Cloudflare.Website.Vite<Website>()("Website", {
  rootDir: "../../apps/web",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  assets: {
    runWorkerFirst: true,
  },
}) {}

export default Alchemy.Stack(
  "CrdtRfd",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.Bucket("FoundationBucket");
    const website = yield* Website;

    return {
      bucketName: bucket.bucketName,
      websiteUrl: website.url.as<string>(),
    };
  }),
);
