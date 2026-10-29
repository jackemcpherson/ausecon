import { Effect } from "effect";
import type { HttpClient } from "effect/http";

import type {
  RbaSeries,
  RbaTable,
  RbaTableLayoutError,
  RbaTableNotFound,
  RbaUnavailable,
} from "../types";
import { RBA_CONCURRENCY, fetchTable } from "./http";
import { parseRbaTable } from "./table-parse";

/** A statistical table to read: its RbaTable and table URL. */
export interface TableSource {
  readonly table: RbaTable;
  readonly url: string;
}

/**
 * Download and parse statistical tables.
 *
 * Downloads each table once, under the concurrency limit.
 *
 * @param sources - The tables to read.
 * @returns An Effect that yields the Series of each table, in table order.
 */
export const readRbaTables: (
  sources: ReadonlyArray<TableSource>,
) => Effect.Effect<
  ReadonlyArray<ReadonlyArray<RbaSeries>>,
  RbaTableLayoutError | RbaTableNotFound | RbaUnavailable,
  HttpClient.HttpClient
> = Effect.fn("readRbaTables")(function* (sources: ReadonlyArray<TableSource>) {
  return yield* Effect.forEach(
    sources,
    ({ table, url }) =>
      fetchTable(url, table.tableNumber).pipe(
        Effect.flatMap((body) => parseRbaTable(body, table, url)),
      ),
    { concurrency: RBA_CONCURRENCY },
  );
});
