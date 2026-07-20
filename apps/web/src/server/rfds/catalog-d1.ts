import type { D1Database } from "@cloudflare/workers-types";
import {
  CommitSha,
  RfdCheckpoint,
  RfdId,
  RfdNumber,
  RfdStatus,
  RfdSummary,
  UserId,
  RoomRole,
  type CommitSha as CommitShaValue,
  type RfdCheckpoint as RfdCheckpointValue,
  type RfdId as RfdIdValue,
  type RfdNumber as RfdNumberValue,
  type RfdStatus as RfdStatusValue,
  type RfdSummary as RfdSummaryValue,
  type UserId as UserIdValue,
  type RoomRole as RoomRoleValue,
} from "@crdt-rfd/domain";
import { Context, Effect, Layer, Schema } from "effect";

import { cloudflareEnv } from "../env";

const Timestamp = Schema.Number.check(Schema.isInt());
const CatalogRow = Schema.Struct({
  rfd_id: RfdId,
  number: RfdNumber,
  title: Schema.String,
  status: RfdStatus,
  artifact_repo_name: Schema.String,
  artifact_remote: Schema.String,
  head_sha: CommitSha,
  committed_source: Schema.NullOr(Schema.String),
  checkpoint_message: Schema.NullOr(Schema.String),
  forked_from_rfd_id: Schema.NullOr(RfdId),
  forked_from_sha: Schema.NullOr(CommitSha),
  owner_user_id: UserId,
  author: Schema.String,
  updated_at: Timestamp,
});

interface CatalogRecord {
  readonly rfdId: RfdIdValue;
  readonly number: RfdNumberValue;
  readonly title: string;
  readonly status: RfdStatusValue;
  readonly artifactRepoName: string;
  readonly artifactRemote: string;
  readonly headSha: CommitShaValue;
  readonly committedSource: string | null;
  readonly checkpointMessage: string | null;
  readonly forkedFromRfdId: RfdIdValue | null;
  readonly forkedFromSha: CommitShaValue | null;
  readonly ownerUserId: UserIdValue;
  readonly author: string;
  readonly updated: string;
}

interface InsertCatalogRecord {
  readonly rfdId: RfdIdValue;
  readonly number: RfdNumberValue;
  readonly title: string;
  readonly artifactRepoName: string;
  readonly artifactRemote: string;
  readonly headSha: CommitShaValue;
  readonly committedSource: string;
  readonly ownerUserId: UserIdValue;
  readonly timestamp: number;
  readonly forkedFrom?: { readonly rfdId: RfdIdValue; readonly sha: CommitShaValue };
}

export class CatalogQueryFailed extends Schema.TaggedErrorClass<CatalogQueryFailed>()(
  "CatalogQueryFailed",
  { query: Schema.String, cause: Schema.Defect() },
) {}

export class InvalidCatalogRecord extends Schema.TaggedErrorClass<InvalidCatalogRecord>()(
  "InvalidCatalogRecord",
  { query: Schema.String, cause: Schema.Defect() },
) {}

export class RfdNumberAllocationFailed extends Schema.TaggedErrorClass<RfdNumberAllocationFailed>()(
  "RfdNumberAllocationFailed",
  { cause: Schema.Defect() },
) {}

export class GithubAccountNotLinked extends Schema.TaggedErrorClass<GithubAccountNotLinked>()(
  "GithubAccountNotLinked",
  { userId: UserId, cause: Schema.Defect() },
) {}

export class CatalogCheckpointConflict extends Schema.TaggedErrorClass<CatalogCheckpointConflict>()(
  "CatalogCheckpointConflict",
  { rfdId: RfdId, expectedHeadSha: CommitSha },
) {}

const historyDepth = 20;

export interface RfdCatalogStoreShape {
  readonly list: () => Effect.Effect<
    ReadonlyArray<RfdSummaryValue>,
    CatalogQueryFailed | InvalidCatalogRecord
  >;
  readonly getRecord: (
    rfdId: RfdIdValue,
  ) => Effect.Effect<CatalogRecord | null, CatalogQueryFailed | InvalidCatalogRecord>;
  readonly getByArtifactRepoName: (
    artifactRepoName: string,
  ) => Effect.Effect<CatalogRecord | null, CatalogQueryFailed | InvalidCatalogRecord>;
  readonly allocateNumber: () => Effect.Effect<RfdNumberValue, RfdNumberAllocationFailed>;
  readonly loadGithubLogin: (
    userId: UserIdValue,
  ) => Effect.Effect<string, CatalogQueryFailed | GithubAccountNotLinked | InvalidCatalogRecord>;
  readonly insert: (
    record: InsertCatalogRecord & {
      readonly authorName: string;
      readonly checkpointMessage?: string;
    },
  ) => Effect.Effect<void, CatalogQueryFailed>;
  readonly cacheCommittedSource: (input: {
    readonly rfdId: RfdIdValue;
    readonly headSha: CommitShaValue;
    readonly committedSource: string;
  }) => Effect.Effect<void, CatalogQueryFailed>;
  readonly cacheCheckpointMessage: (input: {
    readonly rfdId: RfdIdValue;
    readonly headSha: CommitShaValue;
    readonly checkpointMessage: string;
  }) => Effect.Effect<void, CatalogQueryFailed>;
  readonly getCheckpointSource: (input: {
    readonly rfdId: RfdIdValue;
    readonly sha: CommitShaValue;
  }) => Effect.Effect<string | null, CatalogQueryFailed>;
  readonly cacheCheckpointSource: (input: {
    readonly rfdId: RfdIdValue;
    readonly sha: CommitShaValue;
    readonly source: string;
  }) => Effect.Effect<void, CatalogQueryFailed>;
  readonly commitCheckpoint: (input: {
    readonly rfdId: RfdIdValue;
    readonly expectedHeadSha: CommitShaValue;
    readonly nextHeadSha: CommitShaValue;
    readonly title: string;
    readonly status: RfdStatusValue;
    readonly committedSource: string;
    readonly checkpointMessage: string;
    readonly authorName: string;
    readonly timestamp: number;
  }) => Effect.Effect<void, CatalogQueryFailed | CatalogCheckpointConflict>;
  readonly listHistory: (
    rfdId: RfdIdValue,
  ) => Effect.Effect<ReadonlyArray<RfdCheckpointValue>, CatalogQueryFailed | InvalidCatalogRecord>;
  readonly replaceHistory: (
    rfdId: RfdIdValue,
    checkpoints: ReadonlyArray<RfdCheckpointValue>,
  ) => Effect.Effect<void, CatalogQueryFailed>;
  readonly getRoomRole: (
    rfdId: RfdIdValue,
    userId: UserIdValue,
  ) => Effect.Effect<RoomRoleValue | null, CatalogQueryFailed | InvalidCatalogRecord>;
}

export class RfdCatalogStore extends Context.Service<RfdCatalogStore, RfdCatalogStoreShape>()(
  "crdt-rfd/RfdCatalogStore",
) {}

const selectColumns = `
  SELECT r.rfd_id, r.number, r.title, r.status, r.artifact_repo_name,
    r.artifact_remote, r.head_sha, r.committed_source, r.checkpoint_message,
    r.forked_from_rfd_id, r.forked_from_sha,
    r.owner_user_id, u.name AS author, r.updated_at
  FROM rfd_catalog r
  JOIN user u ON u.id = r.owner_user_id`;

const query = <A>(name: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new CatalogQueryFailed({ query: name, cause }) });

const decodeRow = (name: string, row: unknown) =>
  Schema.decodeUnknownEffect(CatalogRow, { onExcessProperty: "error" })(row).pipe(
    Effect.mapError((cause) => new InvalidCatalogRecord({ query: name, cause })),
  );

const toSummary = (row: typeof CatalogRow.Type) =>
  Schema.decodeUnknownEffect(RfdSummary)({
    rfdId: row.rfd_id,
    number: row.number,
    title: row.title,
    status: row.status,
    author: row.author,
    updated: new Date(row.updated_at).toISOString(),
    labels: [],
  });

const toRecord = (row: typeof CatalogRow.Type): CatalogRecord => ({
  rfdId: row.rfd_id,
  number: row.number,
  title: row.title,
  status: row.status,
  artifactRepoName: row.artifact_repo_name,
  artifactRemote: row.artifact_remote,
  headSha: row.head_sha,
  committedSource: row.committed_source,
  checkpointMessage: row.checkpoint_message,
  forkedFromRfdId: row.forked_from_rfd_id,
  forkedFromSha: row.forked_from_sha,
  ownerUserId: row.owner_user_id,
  author: row.author,
  updated: new Date(row.updated_at).toISOString(),
});

export const makeRfdCatalogStore = (database: D1Database): RfdCatalogStoreShape => ({
  list: Effect.fn("RfdCatalogStore.list")(function* () {
    const result = yield* query("list catalog", () =>
      database.prepare(`${selectColumns} ORDER BY r.updated_at DESC`).all(),
    );
    const rows = yield* Effect.forEach(result.results, (row) => decodeRow("list catalog", row));
    return yield* Effect.forEach(rows, toSummary).pipe(
      Effect.mapError((cause) => new InvalidCatalogRecord({ query: "list catalog", cause })),
    );
  }),
  getRecord: Effect.fn("RfdCatalogStore.getRecord")(function* (rfdId) {
    const value = yield* query("get catalog record", () =>
      database.prepare(`${selectColumns} WHERE r.rfd_id = ?`).bind(rfdId).first(),
    );
    if (value === null) return null;
    const row = yield* decodeRow("get catalog record", value);
    return toRecord(row);
  }),
  getByArtifactRepoName: Effect.fn("RfdCatalogStore.getByArtifactRepoName")(
    function* (artifactRepoName) {
      const value = yield* query("get catalog by artifact repo", () =>
        database
          .prepare(`${selectColumns} WHERE r.artifact_repo_name = ?`)
          .bind(artifactRepoName)
          .first(),
      );
      if (value === null) return null;
      const row = yield* decodeRow("get catalog by artifact repo", value);
      return toRecord(row);
    },
  ),
  allocateNumber: Effect.fn("RfdCatalogStore.allocateNumber")(function* () {
    const row = yield* query("allocate RFD number", () =>
      database
        .prepare(
          "UPDATE rfd_number_sequence SET next_number = next_number + 1 WHERE singleton = 1 RETURNING next_number - 1 AS number",
        )
        .first(),
    ).pipe(Effect.mapError((error) => new RfdNumberAllocationFailed({ cause: error.cause })));
    if (row === null) {
      return yield* new RfdNumberAllocationFailed({
        cause: "D1 returned no row while allocating an RFD number.",
      });
    }
    return yield* Schema.decodeUnknownEffect(Schema.Struct({ number: RfdNumber }))(row).pipe(
      Effect.map((decoded) => decoded.number),
      Effect.mapError((cause) => new RfdNumberAllocationFailed({ cause })),
    );
  }),
  loadGithubLogin: Effect.fn("RfdCatalogStore.loadGithubLogin")(function* (userId) {
    const row = yield* query("load GitHub account", () =>
      database
        .prepare("SELECT account_id FROM account WHERE user_id = ? AND provider_id = 'github'")
        .bind(userId)
        .first(),
    );
    if (row === null) {
      return yield* new GithubAccountNotLinked({
        userId,
        cause: "The signed-in user has no linked GitHub account.",
      });
    }
    return yield* Schema.decodeUnknownEffect(Schema.Struct({ account_id: Schema.String }))(
      row,
    ).pipe(
      Effect.map((decoded) => decoded.account_id),
      Effect.mapError((cause) => new InvalidCatalogRecord({ query: "load GitHub account", cause })),
    );
  }),
  insert: Effect.fn("RfdCatalogStore.insert")(function* (record) {
    const checkpointMessage = record.checkpointMessage ?? "Create RFD";
    yield* query("insert catalog record and owner membership", () =>
      database.batch([
        database
          .prepare(
            `INSERT INTO rfd_catalog
            (rfd_id, number, title, status, artifact_repo_name, artifact_remote, head_sha,
              committed_source, checkpoint_message, forked_from_rfd_id, forked_from_sha,
              owner_user_id, created_at, updated_at)
             VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            record.rfdId,
            record.number,
            record.title,
            record.artifactRepoName,
            record.artifactRemote,
            record.headSha,
            record.committedSource,
            checkpointMessage,
            record.forkedFrom?.rfdId ?? null,
            record.forkedFrom?.sha ?? null,
            record.ownerUserId,
            record.timestamp,
            record.timestamp,
          ),
        database
          .prepare(
            `INSERT INTO rfd_membership_v2 (rfd_id, user_id, role, created_at, updated_at)
             VALUES (?, ?, 'owner', ?, ?)`,
          )
          .bind(record.rfdId, record.ownerUserId, record.timestamp, record.timestamp),
        database
          .prepare(
            `INSERT OR IGNORE INTO rfd_checkpoint_history
              (rfd_id, sha, message, author, created_at, source)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            record.rfdId,
            record.headSha,
            checkpointMessage,
            record.authorName,
            record.timestamp,
            record.committedSource,
          ),
      ]),
    );
  }),
  cacheCommittedSource: Effect.fn("RfdCatalogStore.cacheCommittedSource")((input) =>
    query("cache committed RFD source", () =>
      database
        .prepare("UPDATE rfd_catalog SET committed_source = ? WHERE rfd_id = ? AND head_sha = ?")
        .bind(input.committedSource, input.rfdId, input.headSha)
        .run(),
    ).pipe(Effect.asVoid),
  ),
  cacheCheckpointMessage: Effect.fn("RfdCatalogStore.cacheCheckpointMessage")((input) =>
    query("cache checkpoint message", () =>
      database
        .prepare("UPDATE rfd_catalog SET checkpoint_message = ? WHERE rfd_id = ? AND head_sha = ?")
        .bind(input.checkpointMessage, input.rfdId, input.headSha)
        .run(),
    ).pipe(Effect.asVoid),
  ),
  getCheckpointSource: Effect.fn("RfdCatalogStore.getCheckpointSource")((input) =>
    query("get checkpoint source", () =>
      database
        .prepare("SELECT source FROM rfd_checkpoint_history WHERE rfd_id = ? AND sha = ?")
        .bind(input.rfdId, input.sha)
        .first<{ readonly source: string | null }>(),
    ).pipe(Effect.map((row) => row?.source ?? null)),
  ),
  cacheCheckpointSource: Effect.fn("RfdCatalogStore.cacheCheckpointSource")((input) =>
    query("cache checkpoint source", () =>
      database
        .prepare("UPDATE rfd_checkpoint_history SET source = ? WHERE rfd_id = ? AND sha = ?")
        .bind(input.source, input.rfdId, input.sha)
        .run(),
    ).pipe(Effect.asVoid),
  ),
  commitCheckpoint: Effect.fn("RfdCatalogStore.commitCheckpoint")(function* (input) {
    const result = yield* query("commit RFD checkpoint", () =>
      database
        .prepare(
          `UPDATE rfd_catalog
           SET title = ?, status = ?, head_sha = ?, committed_source = ?, checkpoint_message = ?, updated_at = ?
           WHERE rfd_id = ? AND head_sha = ?`,
        )
        .bind(
          input.title,
          input.status,
          input.nextHeadSha,
          input.committedSource,
          input.checkpointMessage,
          input.timestamp,
          input.rfdId,
          input.expectedHeadSha,
        )
        .run(),
    );
    if (result.meta.changes !== 1) {
      return yield* new CatalogCheckpointConflict({
        rfdId: input.rfdId,
        expectedHeadSha: input.expectedHeadSha,
      });
    }
    yield* query("append checkpoint history", () =>
      database
        .prepare(
          `INSERT OR IGNORE INTO rfd_checkpoint_history
            (rfd_id, sha, message, author, created_at, source)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.rfdId,
          input.nextHeadSha,
          input.checkpointMessage,
          input.authorName,
          input.timestamp,
          input.committedSource,
        )
        .run(),
    );
  }),
  listHistory: Effect.fn("RfdCatalogStore.listHistory")(function* (rfdId) {
    const result = yield* query("list checkpoint history", () =>
      database
        .prepare(
          `SELECT sha, message, author, created_at
           FROM rfd_checkpoint_history
           WHERE rfd_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(rfdId, historyDepth)
        .all(),
    );
    return yield* Effect.forEach(result.results, (row) => {
      const record = row as {
        readonly sha?: unknown;
        readonly message?: unknown;
        readonly author?: unknown;
        readonly created_at?: unknown;
      };
      const createdAtMs =
        typeof record.created_at === "number"
          ? record.created_at
          : typeof record.created_at === "string"
            ? Number(record.created_at)
            : Number.NaN;
      return Schema.decodeUnknownEffect(RfdCheckpoint)({
        sha: record.sha,
        message: record.message,
        author: record.author,
        createdAt: Number.isFinite(createdAtMs)
          ? new Date(createdAtMs).toISOString()
          : record.created_at,
      }).pipe(
        Effect.mapError(
          (cause) => new InvalidCatalogRecord({ query: "list checkpoint history", cause }),
        ),
      );
    });
  }),
  replaceHistory: Effect.fn("RfdCatalogStore.replaceHistory")(function* (rfdId, checkpoints) {
    const limited = checkpoints.slice(0, historyDepth);
    yield* query("replace checkpoint history", () =>
      database.batch(
        limited.map((checkpoint) =>
          database
            .prepare(
              `INSERT INTO rfd_checkpoint_history
                (rfd_id, sha, message, author, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(rfd_id, sha) DO UPDATE SET
                 message = excluded.message,
                 author = excluded.author,
                 created_at = excluded.created_at`,
            )
            .bind(
              rfdId,
              checkpoint.sha,
              checkpoint.message,
              checkpoint.author,
              new Date(checkpoint.createdAt).getTime(),
            ),
        ),
      ),
    );
  }),
  getRoomRole: Effect.fn("RfdCatalogStore.getRoomRole")(function* (rfdId, userId) {
    const row = yield* query("get RFD room role", () =>
      database
        .prepare("SELECT role FROM rfd_membership_v2 WHERE rfd_id = ? AND user_id = ?")
        .bind(rfdId, userId)
        .first(),
    );
    if (row === null) return null;
    return yield* Schema.decodeUnknownEffect(Schema.Struct({ role: RoomRole }))(row).pipe(
      Effect.map((decoded) => decoded.role),
      Effect.mapError((cause) => new InvalidCatalogRecord({ query: "get RFD room role", cause })),
    );
  }),
});

export const RfdCatalogStoreLive = Layer.sync(RfdCatalogStore, () =>
  makeRfdCatalogStore(cloudflareEnv.DB),
);

export type { CatalogRecord, InsertCatalogRecord };
