import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const githubScopes = ["read:user", "user:email"] as const;

export interface AuthEnvironment {
  readonly DB: D1Database;
  readonly APP_ORIGIN: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly GITHUB_CLIENT_ID: string;
  readonly GITHUB_CLIENT_SECRET: string;
}

export const createAuth = (environment: AuthEnvironment) => {
  const baseURL = environment.APP_ORIGIN;
  return betterAuth({
    baseURL,
    trustedOrigins: [baseURL],
    secret: environment.BETTER_AUTH_SECRET,
    database: environment.DB,
    socialProviders: {
      github: {
        clientId: environment.GITHUB_CLIENT_ID,
        clientSecret: environment.GITHUB_CLIENT_SECRET,
        scope: [...githubScopes],
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    plugins: [tanstackStartCookies()],
  });
};
