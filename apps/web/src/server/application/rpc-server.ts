import { Layer } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { ApplicationRpc } from "@/rpc/contracts";
import { applicationMemoMap } from "./runtime";
import { ApplicationRpcLive } from "./rpc-handlers";

const RpcServerLive = RpcServer.layerHttp({
  group: ApplicationRpc,
  path: "/api/rpc",
  protocol: "http",
  spanPrefix: "rfd.rpc",
  disableFatalDefects: true,
}).pipe(Layer.provide(ApplicationRpcLive), Layer.provide(RpcSerialization.layerNdjson));

const HttpLive = Layer.provideMerge(RpcServerLive, HttpRouter.layer);

export const rpcWebHandler = HttpRouter.toWebHandler(HttpLive, {
  memoMap: applicationMemoMap,
});
