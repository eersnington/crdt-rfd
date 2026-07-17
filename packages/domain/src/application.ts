import { Schema } from "effect";
import { RfdStatus } from "./contracts.ts";
import { RfdNumber, UserId } from "./values.ts";

const IsoTimestamp = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/),
  Schema.makeFilter((value) => !Number.isNaN(Date.parse(value)), {
    expected: "a valid ISO 8601 timestamp with an explicit timezone",
  }),
);

export const RfdSummary = Schema.Struct({
  number: RfdNumber,
  title: Schema.String,
  status: RfdStatus,
  author: Schema.String,
  updated: IsoTimestamp,
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
