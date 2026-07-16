import type { D1Database } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

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
      },
    },
    user: {
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      fields: {
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        userId: "user_id",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: "cookie",
      fields: {
        accountId: "account_id",
        providerId: "provider_id",
        userId: "user_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    onAPIError: {
      onError: (error) => {
        console.error("Better Auth request failed", error);
      },
    },
    plugins: [tanstackStartCookies()],
  });
};
