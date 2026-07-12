import { createAuth } from "./auth-config.ts";
import { cloudflareEnv } from "./env.ts";

export const auth = createAuth(cloudflareEnv);
