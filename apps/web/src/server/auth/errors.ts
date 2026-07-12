import { Data } from "effect";

export class OAuthStateError extends Data.TaggedError("OAuthStateError")<{
  readonly reason: "missing" | "mismatch" | "expired";
}> {}

export class OAuthProviderDeniedError extends Data.TaggedError("OAuthProviderDeniedError")<{
  readonly code: string;
  readonly description?: string;
}> {}

export class IdentityProviderError extends Data.TaggedError("IdentityProviderError")<{
  readonly operation: "exchange-code" | "load-identity";
  readonly message: string;
  readonly retryable: boolean;
}> {}

export class SessionStoreError extends Data.TaggedError("SessionStoreError")<{
  readonly operation: "create" | "read" | "delete";
  readonly message: string;
}> {}

export class AccountLinkConflictError extends Data.TaggedError("AccountLinkConflictError")<{
  readonly provider: "github";
  readonly providerAccountId: string;
  readonly existingUserId: string;
}> {}

export class MembershipStoreError extends Data.TaggedError("MembershipStoreError")<{
  readonly operation: "load";
  readonly message: string;
}> {}
