import type { RfdState } from "@crdt-rfd/domain";

export const stateOrder: ReadonlyArray<RfdState> = [
  "discussion",
  "published",
  "committed",
  "draft",
  "abandoned",
];

export const stateLabels: Record<RfdState, string> = {
  published: "Published",
  discussion: "Discussion",
  draft: "Draft",
  committed: "Committed",
  abandoned: "Abandoned",
};
