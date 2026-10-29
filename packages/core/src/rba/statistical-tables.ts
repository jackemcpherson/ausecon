import { Effect, Match } from "effect";
import type { HttpClient } from "effect/http";

import {
  type DecodedRbaRequest,
  type InvalidRequest,
  type RbaRequest,
  type RbaSeries,
  RbaTableLayoutError,
  RbaTableNotFound,
  type RbaTableRequest,
  type RbaUnavailable,
} from "../types";
import { type TableSource, readRbaTables } from "./download";
import { decodeRbaRequest } from "./request";
import { findTable, findUnreadableTable } from "./series-index";

/** Every error an RBA read can fail with. */
export type ReadRbaError = InvalidRequest | RbaTableNotFound | RbaTableLayoutError | RbaUnavailable;

/**
 * Find each requested table in the series index, before any request.
 *
 * Fails with `RbaTableNotFound` naming every table number the index does not
 * list, then with `RbaTableLayoutError` for the first table it lists as
 * unreadable.
 */
const locateTables = (
  request: RbaTableRequest,
): Effect.Effect<ReadonlyArray<TableSource>, RbaTableNotFound | RbaTableLayoutError> => {
  const tableNumbers = [...new Set(request.tableNumbers)];

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
  locateTables(request).pipe(
    Effect.flatMap(readRbaTables),
    Effect.map((tables) => tables.flat()),
  );

const readDecoded: (
  request: DecodedRbaRequest,
) => Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> =
  Match.type<DecodedRbaRequest>().pipe(Match.tag("Table", readTables), Match.exhaustive);

/**
 * Read current RBA statistical tables.
 *
 * A `Table` request reads tables by RBA table number. The read finds each
 * table through the series index that ships with the library, so it makes no
 * request for a table the index does not list. It downloads each table once
 * and returns one Series per series ID: in request order, then column order.
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
 * ```
 */
export const readRba: (
  request: RbaRequest,
) => Effect.Effect<ReadonlyArray<RbaSeries>, ReadRbaError, HttpClient.HttpClient> = Effect.fn(
  "readRba",
)(function* (request: RbaRequest) {
  return yield* readDecoded(yield* decodeRbaRequest(request));
});
