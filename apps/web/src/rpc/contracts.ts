import {
  CatalogUnavailable,
  OptionalCurrentSession,
  RfdSummaries,
  SessionUnavailable,
} from "@crdt-rfd/domain";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

export const CatalogRpc = RpcGroup.make(
  Rpc.make("list").setSuccess(RfdSummaries).setError(CatalogUnavailable),
).prefix("catalog_");

export const SessionRpc = RpcGroup.make(
  Rpc.make("getCurrent").setSuccess(OptionalCurrentSession).setError(SessionUnavailable),
).prefix("session_");

export const ApplicationRpc = RpcGroup.make().merge(CatalogRpc, SessionRpc);
