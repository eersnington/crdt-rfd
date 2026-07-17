import { Result, Schema, SchemaParser } from "effect";
import { parse, stringify } from "yaml";
import { RfdStatus } from "./contracts.ts";
import { ValidationError } from "./errors.ts";
import { RfdNumber } from "./values.ts";

const DateOnly = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.makeFilter(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { expected: "a valid calendar date in YYYY-MM-DD format" },
  ),
);
const Principal = Schema.String.check(
  Schema.isPattern(/^github:[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/),
);
const NonEmptyPrincipals = Schema.Array(Principal).check(Schema.isMinLength(1));
export const RfdFrontmatter = Schema.Struct({
  number: RfdNumber,
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  status: RfdStatus,
  authors: NonEmptyPrincipals,
  created: DateOnly,
  updated: DateOnly,
  reviewers: Schema.Array(Principal),
  supersedes: Schema.Array(RfdNumber),
  related: Schema.Array(RfdNumber),
});
export type RfdFrontmatter = typeof RfdFrontmatter.Type;
export interface RfdDocument {
  readonly frontmatter: RfdFrontmatter;
  readonly body: string;
}

const decode = SchemaParser.decodeUnknownResult(RfdFrontmatter, {
  onExcessProperty: "error",
});

export const parseRfdDocument = (source: string): Result.Result<RfdDocument, ValidationError> => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
  if (match === null)
    return Result.fail(
      new ValidationError({
        message: "RFD Markdown must begin with a complete YAML frontmatter block.",
      }),
    );
  let raw: unknown;
  try {
    raw = parse(match[1]!, { uniqueKeys: true });
  } catch (cause) {
    return Result.fail(
      new ValidationError({ message: `Could not parse YAML frontmatter: ${String(cause)}` }),
    );
  }
  const decoded = decode(raw);
  return Result.mapError(
    Result.map(decoded, (frontmatter) => ({ frontmatter, body: match[2]! })),
    (error) =>
      new ValidationError({
        message: "RFD frontmatter is invalid. Correct the listed fields and try again.",
        issues: [String(error)],
      }),
  );
};

export const serializeRfdDocument = ({ frontmatter, body }: RfdDocument): string => {
  const ordered = {
    number: frontmatter.number,
    title: frontmatter.title,
    status: frontmatter.status,
    authors: [...frontmatter.authors],
    created: frontmatter.created,
    updated: frontmatter.updated,
    reviewers: [...frontmatter.reviewers],
    supersedes: [...frontmatter.supersedes],
    related: [...frontmatter.related],
  };
  return `---\n${stringify(ordered, { lineWidth: 0 })}---\n${body}`;
};

export const validateRfdCatalog = (
  documents: readonly RfdDocument[],
): Result.Result<void, ValidationError> => {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const document of documents) {
    const number = document.frontmatter.number;
    if (seen.has(number)) duplicates.add(number);
    else seen.add(number);
  }
  return duplicates.size === 0
    ? Result.succeed(undefined)
    : Result.fail(
        new ValidationError({
          message: `Duplicate RFD number(s) ${[...duplicates].sort((a, b) => a - b).join(", ")} found. Assign each RFD a unique number.`,
        }),
      );
};
