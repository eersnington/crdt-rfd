import * as Cloudflare from "cloudflare:workers";
import type { WebsiteEnv } from "../../../../packages/infra/alchemy.run.ts";

export const cloudflareEnv = new Proxy({} as WebsiteEnv, {
  get: (_target, property) => {
    return Cloudflare.env[property as keyof typeof Cloudflare.env];
  },
});
