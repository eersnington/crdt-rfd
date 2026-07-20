import type { RfdStatus } from "./contracts.ts";

const statusLabel = (status: RfdStatus): string =>
  `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

export type CheckpointChangeSnapshot = {
  readonly title: string;
  readonly status: RfdStatus;
  readonly body: string;
};

/** Build a short Git message when the user did not supply one. */
export const describeAutoCheckpointMessage = (
  previous: CheckpointChangeSnapshot | null,
  next: CheckpointChangeSnapshot,
): string => {
  if (previous === null) return "Update RFD";

  const parts: string[] = [];
  if (previous.status !== next.status) {
    parts.push(`Status → ${statusLabel(next.status)}`);
  }
  if (previous.title !== next.title) {
    parts.push(`Rename to “${next.title}”`);
  }
  if (previous.body !== next.body) {
    parts.push("Update body");
  }
  return parts.length === 0 ? "Update RFD" : parts.join("; ");
};
