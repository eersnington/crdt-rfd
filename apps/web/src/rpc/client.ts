import { Layer } from "effect";
import { Effect } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

import { ApplicationRpc } from "./contracts";
import { SessionUnavailable, type RfdId, type RfdStatus } from "@crdt-rfd/domain";
import { authClient } from "../lib/auth-client";

const RpcProtocolLive = RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
  Layer.provide(FetchHttpClient.layer),
);

export class ApplicationRpcClient extends AtomRpc.Service<ApplicationRpcClient>()(
  "ApplicationRpcClient",
  {
    group: ApplicationRpc,
    protocol: RpcProtocolLive,
  },
) {}

export const catalogHydrationAtom = ApplicationRpcClient.query("catalog_list", undefined, {
  serializationKey: "all",
});

export const catalogAtom = Atom.withReactivity(["catalog"])(catalogHydrationAtom);

export const createRfdAtom = ApplicationRpcClient.mutation("rfd_create");

export const rfdDocumentAtom = Atom.family((rfdId: RfdId) =>
  ApplicationRpcClient.query("rfd_get", { rfdId }, { serializationKey: rfdId }),
);

export const rfdHistoryAtom = Atom.family((rfdId: RfdId) =>
  ApplicationRpcClient.query("rfd_history", { rfdId }, { serializationKey: rfdId }),
);

export const sessionAtom = ApplicationRpcClient.query("session_getCurrent", undefined, {
  serializationKey: "current",
});

export const searchDialogOpenAtom = Atom.make(false);
export const selectedStatusesAtom = Atom.make(new Set<RfdStatus>());
export const selectedAuthorsAtom = Atom.make(new Set<string>());
export const selectedLabelsAtom = Atom.make(new Set<string>());
export const sortDescendingAtom = Atom.make(true);

export const catalogItemsAtom = Atom.make((get) => {
  const result = get(catalogAtom);
  return AsyncResult.isSuccess(result) ? result.value : [];
});

export const availableAuthorsAtom = Atom.make((get) =>
  Array.from(new Set(get(catalogItemsAtom).map((rfd) => rfd.author))).sort(),
);

export const availableLabelsAtom = Atom.make((get) =>
  Array.from(new Set(get(catalogItemsAtom).flatMap((rfd) => rfd.labels))).sort(),
);

export const filteredRfdsAtom = Atom.make((get) => {
  const statuses = get(selectedStatusesAtom);
  const authors = get(selectedAuthorsAtom);
  const labels = get(selectedLabelsAtom);

  return [...get(catalogItemsAtom)]
    .filter((rfd) => statuses.size === 0 || statuses.has(rfd.status))
    .filter((rfd) => authors.size === 0 || authors.has(rfd.author))
    .filter((rfd) => labels.size === 0 || rfd.labels.some((label) => labels.has(label)))
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
});

export const sortedRfdsAtom = Atom.make((get) => {
  const results = get(filteredRfdsAtom);
  return get(sortDescendingAtom) ? results : [...results].reverse();
});

export const activeFilterCountAtom = Atom.make(
  (get) =>
    get(selectedStatusesAtom).size + get(selectedAuthorsAtom).size + get(selectedLabelsAtom).size,
);

export const signOutAtom = Atom.fn<void>()((_input, get) =>
  Effect.tryPromise({
    try: () => authClient.signOut(),
    catch: () =>
      new SessionUnavailable({
        operation: "sign out",
        message: "The session could not be ended. Check your connection and try again.",
      }),
  }).pipe(
    Effect.flatMap((result) =>
      result.error
        ? Effect.fail(
            new SessionUnavailable({
              operation: "sign out",
              message: result.error.message ?? "Better Auth rejected the sign-out request.",
            }),
          )
        : Effect.void,
    ),
    Effect.tap(() => Effect.sync(() => get.refresh(sessionAtom))),
  ),
);
