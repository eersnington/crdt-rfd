import type { D1Database } from "@cloudflare/workers-types";
import {
  RfdSummaries,
  type CommitSha,
  type RfdId,
  type RfdNumber,
  type RfdStatus,
  type RfdSummary,
  type UserId,
} from "@crdt-rfd/domain";
import { Schema } from "effect";

interface CatalogRecord {
  readonly rfdId: RfdId;
  readonly number: RfdNumber;
  readonly title: string;
  readonly status: RfdStatus;
  readonly artifactRepoName: string;
  readonly artifactRemote: string;
  readonly headSha: CommitSha;
  readonly committedSource: string | null;
  readonly ownerUserId: UserId;
  readonly author: string;
  readonly updated: string;
}

interface CatalogRow {
  readonly rfd_id: string;
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly artifact_repo_name: string;
  readonly artifact_remote: string;
  readonly head_sha: string;
  readonly committed_source: string | null;
  readonly owner_user_id: string;
  readonly author: string;
  readonly updated_at: number;
}

const summaryRows = (rows: readonly CatalogRow[]) =>
  Schema.decodeUnknownPromise(RfdSummaries)(
    rows.map((row) => ({
      rfdId: row.rfd_id,
      number: row.number,
      title: row.title,
      status: row.status,
      author: row.author,
      updated: new Date(row.updated_at).toISOString(),
      labels: [],
    })),
  );

const selectColumns = `
  SELECT r.rfd_id, r.number, r.title, r.status, r.artifact_repo_name,
    r.artifact_remote, r.head_sha, r.committed_source, r.owner_user_id, u.name AS author, r.updated_at
  FROM rfd_catalog r
  JOIN user u ON u.id = r.owner_user_id`;

export const listCatalog = async (database: D1Database): Promise<ReadonlyArray<RfdSummary>> => {
  const result = await database
    .prepare(`${selectColumns} ORDER BY r.updated_at DESC`)
    .all<CatalogRow>();
  return summaryRows(result.results);
};

export const getCatalogRecord = async (
  database: D1Database,
  rfdId: RfdId,
): Promise<CatalogRecord | null> => {
  const row = await database
    .prepare(`${selectColumns} WHERE r.rfd_id = ?`)
    .bind(rfdId)
    .first<CatalogRow>();
  if (row === null) return null;
  const [summary] = await summaryRows([row]);
  if (summary === undefined) return null;
  return {
    ...summary,
    artifactRepoName: row.artifact_repo_name,
    artifactRemote: row.artifact_remote,
    headSha: row.head_sha as CommitSha,
    committedSource: row.committed_source,
    ownerUserId: row.owner_user_id as UserId,
  };
};

export const allocateRfdNumber = async (database: D1Database): Promise<number> => {
  const row = await database
    .prepare(
      "UPDATE rfd_number_sequence SET next_number = next_number + 1 WHERE singleton = 1 RETURNING next_number - 1 AS number",
    )
    .first<{ readonly number: number }>();
  if (row === null) throw new Error("D1 did not return an allocated RFD number.");
  return row.number;
};

export const loadGithubLogin = async (database: D1Database, userId: UserId) => {
  const row = await database
    .prepare("SELECT account_id FROM account WHERE user_id = ? AND provider_id = 'github'")
    .bind(userId)
    .first<{ readonly account_id: string }>();
  if (row === null) throw new Error("The signed-in user has no GitHub account record.");
  return row.account_id;
};

export const insertCatalogRecord = async (
  database: D1Database,
  record: {
    readonly rfdId: RfdId;
    readonly number: RfdNumber;
    readonly title: string;
    readonly artifactRepoName: string;
    readonly artifactRemote: string;
    readonly headSha: CommitSha;
    readonly committedSource: string;
    readonly ownerUserId: UserId;
    readonly timestamp: number;
  },
) =>
  database
    .prepare(
      `INSERT INTO rfd_catalog
       (rfd_id, number, title, status, artifact_repo_name, artifact_remote, head_sha,
        committed_source, owner_user_id, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.rfdId,
      record.number,
      record.title,
      record.artifactRepoName,
      record.artifactRemote,
      record.headSha,
      record.committedSource,
      record.ownerUserId,
      record.timestamp,
      record.timestamp,
    )
    .run();

export const cacheCommittedSource = (
  database: D1Database,
  rfdId: RfdId,
  headSha: CommitSha,
  committedSource: string,
) =>
  database
    .prepare("UPDATE rfd_catalog SET committed_source = ? WHERE rfd_id = ? AND head_sha = ?")
    .bind(committedSource, rfdId, headSha)
    .run();
