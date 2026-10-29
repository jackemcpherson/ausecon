import {
  type AbsRequest,
  type AbsSeries,
  type RbaRequest,
  type RbaSeries,
  type ReadAbsError,
  type ReadRbaError,
  readAbs,
  readRba,
  type SeriesIndexEntry,
  searchSeries,
} from "@ausecon/core";
import { Context, Effect, Layer } from "effect";
import type { HttpClient } from "effect/http";

/**
 * Reads series from each publisher, and searches the series index, for the tool.
 *
 * Commands read through this service, so tests can hand in Series or a chosen
 * failure without an HTTP fixture. The entry point provides `Reader.layer`.
 */
export class Reader extends Context.Service<
  Reader,
  {
    readonly readAbs: (
      request: AbsRequest,
    ) => Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError>;
    readonly readRba: (
      request: RbaRequest,
    ) => Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError>;
    /** Every series index entry that matches all the words, with no limit. */
    readonly search: (
      words: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<SeriesIndexEntry>>;
  }
>()("ausecon/Reader") {
  /**
   * The live reader: `readAbs` and `readRba` over the `HttpClient` in context,
   * and `searchSeries`, which makes no request.
   */
  static readonly layer: Layer.Layer<Reader, never, HttpClient.HttpClient> = Layer.effect(
    Reader,
    Effect.map(Effect.context<HttpClient.HttpClient>(), (context) => ({
      readAbs: (request: AbsRequest) => readAbs(request).pipe(Effect.provideContext(context)),
      readRba: (request: RbaRequest) => readRba(request).pipe(Effect.provideContext(context)),
      search: (words: ReadonlyArray<string>) => Effect.sync(() => searchSeries(words)),
    })),
  );
}
