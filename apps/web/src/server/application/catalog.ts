import { CatalogUnavailable, RfdSummaries, type RfdSummary } from "@crdt-rfd/domain";
import { Context, Effect, Layer, SchemaParser } from "effect";

import { rfds } from "../../lib/rfd-data";

export interface RfdCatalogShape {
  readonly list: Effect.Effect<ReadonlyArray<RfdSummary>, CatalogUnavailable>;
}

export class RfdCatalog extends Context.Service<RfdCatalog, RfdCatalogShape>()("RfdCatalog") {}

const list = SchemaParser.decodeUnknownEffect(RfdSummaries)(rfds).pipe(
  Effect.tapError((cause) => Effect.logError("RFD catalog fixture decoding failed", cause)),
  Effect.mapError(
    () =>
      new CatalogUnavailable({
        operation: "decode catalog fixtures",
        message: "The RFD catalog is unavailable because its data is invalid.",
      }),
  ),
);

export const RfdCatalogLive = Layer.succeed(RfdCatalog)(RfdCatalog.of({ list }));
