import {
  CatalogUnavailable,
  CommittedRfdDocument,
  CreateRfdInput,
  GetRfdInput,
  OptionalCurrentSession,
  RfdOperationFailed,
  RfdCheckpoints,
  RfdSummary,
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

export const RfdRpc = RpcGroup.make(
  Rpc.make("create").setPayload(CreateRfdInput).setSuccess(RfdSummary).setError(RfdOperationFailed),
  Rpc.make("get")
    .setPayload(GetRfdInput)
    .setSuccess(CommittedRfdDocument)
    .setError(RfdOperationFailed),
  Rpc.make("history")
    .setPayload(GetRfdInput)
    .setSuccess(RfdCheckpoints)
    .setError(RfdOperationFailed),
).prefix("rfd_");

export const ApplicationRpc = RpcGroup.make().merge(CatalogRpc, SessionRpc, RfdRpc);
