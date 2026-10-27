import { Effect, Match, Predicate } from "effect";
import type { HttpClient } from "effect/http";

import type {
  AbsRequest,
  AbsUnavailable,
  CatalogueNotFound,
  CatalogueRequest,
  DecodedAbsRequest,
  InvalidRequest,
  Series,
  SeriesRequest,
  TableNotFound,
  TimeSeriesDirectoryError,
  TableLayoutError,
} from "../types";
import { SeriesNotFound } from "../types";
import { readTables } from "./download";
import { ABS_CONCURRENCY } from "./http";
import { decodeRequest } from "./request";
import { catalogueTables, seriesTable } from "./time-series-directory";

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
): Effect.Effect<ReadonlyArray<Series>, ReadAbsError, HttpClient.HttpClient> =>
  catalogueTables(request.catalogueNumber, request.tableNumbers).pipe(
    Effect.flatMap(readTables),
    Effect.map((tables) => tables.flatMap(({ series }) => series)),
  );

const readSeries = (
  request: SeriesRequest,
): Effect.Effect<ReadonlyArray<Series>, ReadAbsError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const found = yield* Effect.forEach(
      new Set(request.seriesIds),
      (seriesId) => Effect.map(seriesTable(seriesId), (located) => ({ seriesId, located })),
      { concurrency: ABS_CONCURRENCY },
    );

    const missing = found
      .filter(({ located }) => located === undefined)
      .map(({ seriesId }) => seriesId);

    if (missing.length > 0) {
      return yield* new SeriesNotFound({ seriesIds: missing });
    }

    const located = found.map((entry) => entry.located).filter(Predicate.isNotUndefined);

    // The series IDs each table URL holds, since two tables can share a table ID.
    const wanted = new Map(
      [...Map.groupBy(located, ({ row }) => row.tableUrl)].map(([tableUrl, group]) => [
        tableUrl,
        new Set(group.map(({ row }) => row.seriesId)),
      ]),
    );

    const tables = yield* readTables(
      new Map(located.map(({ table, row }) => [row.tableUrl, table])),
    );

    return tables.flatMap(({ tableUrl, series }) =>
      series.filter(({ seriesId }) => wanted.get(tableUrl)?.has(seriesId) === true),
    );
  });

const readDecoded: (
  request: DecodedAbsRequest,
) => Effect.Effect<ReadonlyArray<Series>, ReadAbsError, HttpClient.HttpClient> =
  Match.type<DecodedAbsRequest>().pipe(
    Match.tag("Catalogue", readCatalogue),
    Match.tag("Series", readSeries),
    Match.exhaustive,
  );

/**
 * Read ABS time series from the latest release.
 *
 * A `Catalogue` request reads the tables of a catalogue number. A `Series`
 * request reads series IDs and returns only the requested Series. The read
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
) => Effect.Effect<ReadonlyArray<Series>, ReadAbsError, HttpClient.HttpClient> = Effect.fn(
  "readAbs",
)(function* (request: AbsRequest) {
  return yield* readDecoded(yield* decodeRequest(request));
});
