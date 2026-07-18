import { Layer } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { ApplicationRpc } from "../../rpc/contracts";
import { ApplicationRpcLive } from "./rpc-handlers";
import { ApplicationLive } from "./layers";

const RpcServerLive = RpcServer.layerHttp({
  group: ApplicationRpc,
  path: "/api/rpc",
  protocol: "http",
  spanPrefix: "rfd.rpc",
  disableFatalDefects: true,
}).pipe(
  Layer.provide(ApplicationRpcLive.pipe(Layer.provide(ApplicationLive))),
  Layer.provide(RpcSerialization.layerNdjson),
);

const HttpLive = Layer.provideMerge(RpcServerLive, HttpRouter.layer);

export const rpcWebHandler = HttpRouter.toWebHandler(HttpLive);
