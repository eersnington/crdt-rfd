import { RfdStatus, type RfdStatus as RfdStatusValue } from "@crdt-rfd/domain";
import { Result, Schema } from "effect";

export const statusOrder: ReadonlyArray<RfdStatusValue> = [
  "discussion",
  "accepted",
  "draft",
  "rejected",
  "superseded",
];

export const statusLabels: Record<RfdStatusValue, string> = {
  accepted: "Accepted",
  discussion: "Discussion",
  draft: "Draft",
  rejected: "Rejected",
  superseded: "Superseded",
};

export const statusDescriptions: Record<RfdStatusValue, string> = {
  draft: "Work in progress. Not yet open for review.",
  discussion: "Open for feedback and review.",
  accepted: "Consensus reached. Ready to implement.",
  rejected: "Closed without acceptance. Terminal state.",
  superseded: "Replaced by a later RFD. Terminal state.",
};

export const parseRfdStatus = (value: unknown): RfdStatusValue => {
  const decoded = Schema.decodeUnknownResult(RfdStatus)(value);
  return Result.isSuccess(decoded) ? decoded.success : "draft";
};
