import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import type { DBAdapterInstance } from "better-auth/adapters";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { makeAuthDatabase } from "./auth-database";

export interface AuthEnvironment {
  readonly DB: D1Database;
  readonly APP_ORIGIN: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly GITHUB_CLIENT_ID: string;
  readonly GITHUB_CLIENT_SECRET: string;
}

export const createAuth = (
  environment: AuthEnvironment,
  database: DBAdapterInstance = makeAuthDatabase(environment.DB),
) => {
  const baseURL = environment.APP_ORIGIN;
  return betterAuth({
    baseURL,
    trustedOrigins: [baseURL],
    secret: environment.BETTER_AUTH_SECRET,
    database,
    socialProviders: {
      github: {
        clientId: environment.GITHUB_CLIENT_ID,
        clientSecret: environment.GITHUB_CLIENT_SECRET,
      },
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: "cookie",
    },
    onAPIError: {
      onError: (error) => {
        console.error("Better Auth request failed", error);
      },
    },
    plugins: [tanstackStartCookies()],
  });
};
