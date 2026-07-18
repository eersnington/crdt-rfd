import { CatalogUnavailable, type RfdSummary } from "@crdt-rfd/domain";
import { Context, Effect, Layer } from "effect";
import { RfdRepository } from "../rfds/repository";

export interface RfdCatalogShape {
  readonly list: () => Effect.Effect<ReadonlyArray<RfdSummary>, CatalogUnavailable>;
}

export class RfdCatalog extends Context.Service<RfdCatalog, RfdCatalogShape>()("RfdCatalog") {}

export const RfdCatalogLive = Layer.effect(
  RfdCatalog,
  Effect.gen(function* () {
    const repository = yield* RfdRepository;
    const list = Effect.fn("RfdCatalog.list")(() =>
      repository.list().pipe(
        Effect.tapError((cause) => Effect.logError("RFD catalog lookup failed", cause)),
        Effect.mapError(
          () =>
            new CatalogUnavailable({
              operation: "list RFD catalog",
              message: "The RFD catalog could not be loaded. Refresh the page to try again.",
            }),
        ),
      ),
    );
    return RfdCatalog.of({ list });
  }),
);
