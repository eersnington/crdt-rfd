import type { RfdStatus } from "@crdt-rfd/domain";

export const statusOrder: ReadonlyArray<RfdStatus> = [
  "discussion",
  "accepted",
  "draft",
  "rejected",
  "superseded",
];

export const statusLabels: Record<RfdStatus, string> = {
  accepted: "Accepted",
  discussion: "Discussion",
  draft: "Draft",
  rejected: "Rejected",
  superseded: "Superseded",
};
