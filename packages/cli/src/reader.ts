import { type AbsRequest, type AbsSeries, type ReadAbsError, readAbs } from "@ausecon/core";
import { Context, Effect, Layer } from "effect";
import type { HttpClient } from "effect/http";

/**
 * Reads ABS time series for the tool.
 *
 * Commands read through this service, so tests can hand in Series or a chosen
 * failure without an HTTP fixture. The entry point provides `AbsReader.layer`.
 */
export class AbsReader extends Context.Service<
  AbsReader,
  {
    readonly read: (request: AbsRequest) => Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError>;
  }
>()("ausecon/AbsReader") {
  /** The live reader: `readAbs` over the `HttpClient` in context. */
  static readonly layer: Layer.Layer<AbsReader, never, HttpClient.HttpClient> = Layer.effect(
    AbsReader,
    Effect.map(Effect.context<HttpClient.HttpClient>(), (context) => ({
      read: (request: AbsRequest) => readAbs(request).pipe(Effect.provideContext(context)),
    })),
  );
}
