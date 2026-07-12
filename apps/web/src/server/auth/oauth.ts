import { Effect } from "effect";
import { pkceChallenge, randomToken } from "./crypto.ts";
import { IdentityProvider } from "./identity-provider.ts";
import { OAuthProviderDeniedError, OAuthStateError } from "./errors.ts";

export const githubIdentityScopes = ["read:user", "user:email"] as const;

export interface OAuthTransaction {
  readonly state: string;
  readonly verifier: string;
  readonly expiresAt: number;
}

export const beginGitHubOAuth = async (input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly now: number;
  readonly ttlMs?: number;
}): Promise<{ readonly url: URL; readonly transaction: OAuthTransaction }> => {
  const transaction = {
    state: randomToken(),
    verifier: randomToken(48),
    expiresAt: input.now + (input.ttlMs ?? 10 * 60_000),
  };
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: githubIdentityScopes.join(" "),
    state: transaction.state,
    code_challenge: await pkceChallenge(transaction.verifier),
    code_challenge_method: "S256",
  }).toString();
  return { url, transaction };
};

export const completeGitHubOAuth = (input: {
  readonly query: URLSearchParams;
  readonly transaction?: OAuthTransaction;
  readonly now: number;
}) =>
  Effect.gen(function* () {
    if (input.transaction === undefined) return yield* new OAuthStateError({ reason: "missing" });
    if (input.transaction.expiresAt <= input.now)
      return yield* new OAuthStateError({ reason: "expired" });
    if (input.query.get("state") !== input.transaction.state)
      return yield* new OAuthStateError({ reason: "mismatch" });
    const denied = input.query.get("error");
    if (denied !== null)
      return yield* new OAuthProviderDeniedError({
        code: denied,
        description: input.query.get("error_description") ?? undefined,
      });
    const code = input.query.get("code");
    if (code === null) return yield* new OAuthProviderDeniedError({ code: "missing_code" });
    const provider = yield* IdentityProvider;
    const accessToken = yield* provider.exchangeCode(code, input.transaction.verifier);
    return yield* provider.loadIdentity(accessToken);
  });
