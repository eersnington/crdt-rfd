import { env } from "cloudflare:workers";
import type { WebsiteEnv } from "../../../../packages/infra/alchemy.run";

export const cloudflareEnv = env as WebsiteEnv;
