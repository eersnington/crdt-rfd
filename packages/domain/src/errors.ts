import { Data } from "effect";

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly issues?: readonly string[];
}> {}
export class AuthorizationError extends Data.TaggedError("AuthorizationError")<{
  readonly message: string;
}> {}
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly entity: string;
  readonly identifier: string;
}> {}
export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly operation: string;
  readonly message: string;
}> {}
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly provider: string;
  readonly operation: string;
  readonly message: string;
  readonly retryable: boolean;
}> {}
