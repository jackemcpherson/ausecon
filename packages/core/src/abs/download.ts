import { Effect } from "effect";
import type { HttpClient } from "effect/http";

import type {
  AbsSeries,
  AbsUnavailable,
  TableLayoutError,
  TimeSeriesDirectoryError,
} from "../types";
import { ABS_CONCURRENCY, fetchBytes } from "./http";
import { parseTable } from "./table-parse";
import type { Tables } from "./time-series-directory";

/** The Series of one downloaded table, and the table URL it came from. */
export interface TableSeries {
  readonly tableUrl: string;
  readonly series: ReadonlyArray<AbsSeries>;
}

/**
 * Download and parse tables.
 *
 * Downloads each table URL once, under the concurrency limit, after replacing
 * spaces in the URL with `+`.
 *
 * @param tables - The tables to read, by table URL.
 * @returns An Effect that yields the Series of each table, in table order.
 */
export const readTables: (
  tables: Tables,
) => Effect.Effect<
  ReadonlyArray<TableSeries>,
  TableLayoutError | TimeSeriesDirectoryError | AbsUnavailable,
  HttpClient.HttpClient
> = Effect.fn("readTables")(function* (tables: Tables) {
  return yield* Effect.forEach(
    tables,
    ([tableUrl, table]) =>
      fetchBytes(tableUrl.replaceAll(" ", "+")).pipe(
        Effect.flatMap((body) => parseTable(body, table)),
        Effect.map((series) => ({ tableUrl, series })),
      ),
    { concurrency: ABS_CONCURRENCY },
  );
});
