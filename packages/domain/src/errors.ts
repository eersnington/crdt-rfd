import { Schema } from "effect";

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()("ValidationError", {
  message: Schema.String,
  issues: Schema.optionalKey(Schema.Array(Schema.String)),
}) {}

export class AuthorizationError extends Schema.TaggedErrorClass<AuthorizationError>()(
  "AuthorizationError",
  { message: Schema.String },
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", {
  entity: Schema.String,
  identifier: Schema.String,
}) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()("ConflictError", {
  operation: Schema.String,
  message: Schema.String,
}) {}

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()("ProviderError", {
  provider: Schema.String,
  operation: Schema.String,
  message: Schema.String,
  retryable: Schema.Boolean,
}) {}
