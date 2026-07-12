import { Context, Effect, Layer } from "effect";
import { IdentityProviderError } from "./errors.ts";

export interface OAuthIdentity {
  readonly provider: "github";
  readonly providerAccountId: string;
  readonly login: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
}

export interface IdentityProviderShape {
  readonly exchangeCode: (
    code: string,
    verifier: string,
  ) => Effect.Effect<string, IdentityProviderError>;
  readonly loadIdentity: (
    accessToken: string,
  ) => Effect.Effect<OAuthIdentity, IdentityProviderError>;
}

export class IdentityProvider extends Context.Service<IdentityProvider, IdentityProviderShape>()(
  "crdt-rfd/IdentityProvider",
) {}

interface GitHubIdentityProviderOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch?: typeof globalThis.fetch;
}

export const githubIdentityProvider = (
  options: GitHubIdentityProviderOptions,
): IdentityProviderShape => {
  const request = options.fetch ?? globalThis.fetch;
  return {
    exchangeCode: (code, verifier) =>
      Effect.tryPromise({
        try: async () => {
          const response = await request("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: options.clientId,
              client_secret: options.clientSecret,
              code,
              code_verifier: verifier,
            }),
          });
          const body = (await response.json()) as {
            access_token?: string;
            error_description?: string;
          };
          if (!response.ok || body.access_token === undefined)
            throw new Error(body.error_description ?? `GitHub returned HTTP ${response.status}`);
          return body.access_token;
        },
        catch: (cause) =>
          new IdentityProviderError({
            operation: "exchange-code",
            message: String(cause),
            retryable: true,
          }),
      }),
    loadIdentity: (accessToken) =>
      Effect.tryPromise({
        try: async () => {
          const response = await request("https://api.github.com/user", {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const body = (await response.json()) as {
            id?: number;
            login?: string;
            name?: string | null;
            avatar_url?: string;
          };
          if (!response.ok || body.id === undefined || body.login === undefined)
            throw new Error(`GitHub returned HTTP ${response.status}`);
          return {
            provider: "github" as const,
            providerAccountId: String(body.id),
            login: body.login,
            displayName: body.name?.trim() || body.login,
            avatarUrl: body.avatar_url,
          };
        },
        catch: (cause) =>
          new IdentityProviderError({
            operation: "load-identity",
            message: String(cause),
            retryable: true,
          }),
      }),
  };
};

export const githubIdentityProviderLayer = (options: GitHubIdentityProviderOptions) =>
  Layer.succeed(IdentityProvider, githubIdentityProvider(options));
