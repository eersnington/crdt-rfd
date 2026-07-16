import { Schema } from "effect";
import { RfdNumber, UserId } from "./values.ts";

export const RfdState = Schema.Literals([
  "published",
  "discussion",
  "draft",
  "committed",
  "abandoned",
]);
export type RfdState = typeof RfdState.Type;

export const RfdSummary = Schema.Struct({
  number: RfdNumber,
  title: Schema.String,
  state: RfdState,
  author: Schema.String,
  updated: Schema.String,
  labels: Schema.Array(Schema.String),
});
export type RfdSummary = typeof RfdSummary.Type;

export const RfdSummaries = Schema.Array(RfdSummary);

export const CurrentUser = Schema.Struct({
  id: UserId,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
});
export type CurrentUser = typeof CurrentUser.Type;

export const CurrentSession = Schema.Struct({
  user: CurrentUser,
  expiresAt: Schema.DateValid,
});
export type CurrentSession = typeof CurrentSession.Type;

export const OptionalCurrentSession = Schema.NullOr(CurrentSession);

export class CatalogUnavailable extends Schema.TaggedErrorClass<CatalogUnavailable>()(
  "CatalogUnavailable",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

export class SessionUnavailable extends Schema.TaggedErrorClass<SessionUnavailable>()(
  "SessionUnavailable",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}
