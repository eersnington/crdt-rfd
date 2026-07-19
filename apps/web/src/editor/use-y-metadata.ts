import { useSyncExternalStore } from "react";
import type * as Y from "yjs";

export interface RfdMetadata {
  readonly title?: string;
  readonly status?: string;
  readonly authors?: readonly string[];
  readonly reviewers?: readonly string[];
  readonly supersedes?: readonly number[];
  readonly related?: readonly number[];
}

export const useYMetadata = (metadata: Y.Map<unknown>): RfdMetadata => {
  const subscribe = (listener: () => void) => {
    metadata.observe(listener);
    return () => metadata.unobserve(listener);
  };
  const getSnapshot = () => JSON.stringify(Object.fromEntries(metadata.entries()));
  return JSON.parse(useSyncExternalStore(subscribe, getSnapshot, getSnapshot)) as RfdMetadata;
};
