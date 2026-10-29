import { Effect, Match } from "effect";
import type { HttpClient } from "effect/http";

import {
  type AbsRequest,
  type AbsSeries,
  type AbsUnavailable,
  type CatalogueNotFound,
  type CatalogueRequest,
  type DecodedAbsRequest,
  type InvalidRequest,
  SeriesNotFound,
  type SeriesRequest,
  type TableNotFound,
  type TimeSeriesDirectoryError,
  type TableLayoutError,
} from "../types";
import { readTables } from "./download";
import { decodeRequest } from "./request";
import { catalogueTables, seriesTables } from "./time-series-directory";

/** Every error a read can fail with. */
export type ReadAbsError =
  | InvalidRequest
  | CatalogueNotFound
  | TableNotFound
  | SeriesNotFound
  | TableLayoutError
  | TimeSeriesDirectoryError
  | AbsUnavailable;

const readCatalogue = (
  request: CatalogueRequest,
): Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError, HttpClient.HttpClient> =>
  catalogueTables(request.catalogueNumber, request.tableNumbers).pipe(
    Effect.flatMap(readTables),
    Effect.map((tables) => tables.flatMap(({ series }) => series)),
  );

const readSeries = (
  request: SeriesRequest,
): Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const located = yield* seriesTables(request.seriesIds);
    const tables = yield* readTables(located.tables);

    const series = tables.flatMap(({ tableUrl, series: tableSeries }) =>
      tableSeries.filter(({ seriesId }) => located.seriesIds.get(tableUrl)?.has(seriesId) === true),
    );

    const read = new Set(series.map(({ seriesId }) => seriesId));
    const missing = [...new Set(request.seriesIds)].filter((seriesId) => !read.has(seriesId));

    if (missing.length > 0) {
      return yield* new SeriesNotFound({ seriesIds: missing });
    }

    return series;
  });

const readDecoded: (
  request: DecodedAbsRequest,
) => Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError, HttpClient.HttpClient> =
  Match.type<DecodedAbsRequest>().pipe(
    Match.tag("Catalogue", readCatalogue),
    Match.tag("Series", readSeries),
    Match.exhaustive,
  );

/**
 * Read ABS time series from the latest release.
 *
 * A `Catalogue` request reads the tables of a catalogue number. A `Series`
 * request reads series IDs and returns only the requested Series. It fails
 * with `SeriesNotFound` naming each series ID that the Directory lists in no
 * table, or that its table does not hold. The read
 * queries the Time Series Directory, downloads each table once, and returns
 * one Series per series ID and sheet: in table order, then sheet order, then
 * column order.
 *
 * The Effect requires an `HttpClient`. The library never picks one, so it runs
 * on any runtime. The client must follow redirects, or return them so that
 * the library can follow them.
 *
 * @param request - What to read.
 * @returns An Effect that yields the Series.
 *
 * @example
 * ```typescript
 * const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" }));
 * ```
 */
export const readAbs: (
  request: AbsRequest,
) => Effect.Effect<ReadonlyArray<AbsSeries>, ReadAbsError, HttpClient.HttpClient> = Effect.fn(
  "readAbs",
)(function* (request: AbsRequest) {
  return yield* readDecoded(yield* decodeRequest(request));
});
