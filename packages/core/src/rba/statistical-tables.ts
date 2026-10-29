import { Effect, Match } from "effect";
import type { HttpClient } from "effect/http";

import {
  type DecodedRbaRequest,
  type InvalidRequest,
  type RbaRequest,
  type RbaSeries,
  RbaSeriesNotFound,
  type RbaSeriesRequest,
  RbaTableLayoutError,
  RbaTableNotFound,
  RbaTableNumber,
  type RbaTableRequest,
  type RbaUnavailable,
  type SeriesId,
} from "../types";
import { type TableSource, readRbaTables } from "./download";
import { decodeRbaRequest } from "./request";
import { findSeries, findTable, findUnreadableTable } from "./series-index";

/** Every error an RBA read can fail with. */
export type ReadRbaError =
  | InvalidRequest
  | RbaSeriesNotFound
  | RbaTableNotFound
  | RbaTableLayoutError
  | RbaUnavailable;

/**
 * Find each table in the series index, before any request.
 *
 * Fails with `RbaTableNotFound` naming every table number the index does not
 * list, then with `RbaTableLayoutError` for the first table it lists as
 * unreadable.
 */
const locateTables = (
  requested: ReadonlyArray<RbaTableNumber>,
): Effect.Effect<ReadonlyArray<TableSource>, RbaTableNotFound | RbaTableLayoutError> => {
  const tableNumbers = [...new Set(requested)];

  const missing = tableNumbers.filter(
    (tableNumber) =>
      findTable(tableNumber) === undefined && findUnreadableTable(tableNumber) === undefined,
  );

  if (missing.length > 0) {
    return Effect.fail(new RbaTableNotFound({ tableNumbers: missing }));
  }

  const [unreadable] = tableNumbers.flatMap((tableNumber) => {
    const table = findUnreadableTable(tableNumber);

    return table === undefined ? [] : [{ tableNumber, table }];
  });

  if (unreadable !== undefined) {
    return Effect.fail(
      new RbaTableLayoutError({
        tableNumber: unreadable.tableNumber,
        url: unreadable.table.url,
        reason: `The series index lists the table as unreadable: ${unreadable.table.reason}`,
      }),
    );
  }

  return Effect.succeed(
    tableNumbers.flatMap((tableNumber) => {
      const table = findTable(tableNumber);

      return table === undefined
        ? []
        : [{ table: { tableNumber, tableTitle: table.title }, url: table.url }];
    }),
  );
};

const readTables = (
  request: RbaTableRequest,
): Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> =>
  locateTables(request.tableNumbers).pipe(
    Effect.flatMap(readRbaTables),
    Effect.map((tables) => tables.flat()),
  );

/**
 * The RBA table number of the table that holds each series, from the series
 * index. The series index is the library's own data, so its table numbers are
 * not decoded again.
 */
const tablesOf = (seriesIds: ReadonlyArray<SeriesId>): ReadonlyArray<RbaTableNumber> =>
  seriesIds.flatMap((seriesId) => {
    const series = findSeries(seriesId);

    return series === undefined
      ? []
      : [RbaTableNumber.make(series.tableNumber, { disableChecks: true })];
  });

const readSeries = (
  request: RbaSeriesRequest,
): Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const seriesIds = [...new Set(request.seriesIds)];
    const unindexed = seriesIds.filter((seriesId) => findSeries(seriesId) === undefined);

    if (unindexed.length > 0) {
      return yield* new RbaSeriesNotFound({ seriesIds: unindexed });
    }

    const tables = yield* locateTables(tablesOf(seriesIds)).pipe(Effect.flatMap(readRbaTables));
    const requested = new Set<string>(seriesIds);

    const read = new Map(
      tables
        .flat()
        .filter(({ seriesId }) => requested.has(seriesId))
        .map((series) => [series.seriesId, series]),
    );

    const notHeld = seriesIds.filter((seriesId) => !read.has(seriesId));

    if (notHeld.length > 0) {
      return yield* new RbaSeriesNotFound({ seriesIds: notHeld });
    }

    return seriesIds.flatMap((seriesId) => {
      const series = read.get(seriesId);

      return series === undefined ? [] : [series];
    });
  });

const readDecoded: (
  request: DecodedRbaRequest,
) => Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> =
  Match.type<DecodedRbaRequest>().pipe(
    Match.tag("Table", readTables),
    Match.tag("Series", readSeries),
    Match.exhaustive,
  );

/**
 * Read current RBA statistical tables.
 *
 * A `Table` request reads tables by RBA table number, and returns one Series
 * per series ID: in request order, then column order. A `Series` request reads
 * series IDs without their table numbers, and returns only the requested
 * Series, in request order. It fails with `RbaSeriesNotFound` naming every
 * series ID that the series index does not list, or that its table does not
 * hold.
 *
 * The read finds each table through the series index that ships with the
 * library, so it makes no request for a table or series the index does not
 * list. It downloads each needed table once.
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
 * const series = yield* readRba(RbaRequest.Table({ tableNumbers: ["F1"] }));
 * const cashRateTarget = yield* readRba(RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] }));
 * ```
 */
export const readRba: (
  request: RbaRequest,
) => Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> = Effect.fn(
  "readRba",
)(function* (request: RbaRequest) {
  return yield* readDecoded(yield* decodeRbaRequest(request));
});
