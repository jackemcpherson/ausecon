import { Effect } from "effect";
import type { HttpClient } from "effect/http";

import type { AbsUnavailable, Series, TableLayoutError } from "../types";
import { fetchBytes } from "./http";
import type { DirectoryTable } from "./latest-release";
import { parseTable } from "./table-parse";

/** The most tables downloaded at once. */
const DOWNLOAD_CONCURRENCY = 4;

/** One downloaded table and its series. */
export interface TableSeries {
  readonly table: DirectoryTable;
  readonly series: ReadonlyArray<Series>;
}

/**
 * Download and parse tables.
 *
 * Downloads each distinct `TableURL` once, with a concurrency limit, after
 * replacing spaces in the URL with `+`.
 *
 * @param tables - The tables to read.
 * @returns An Effect that yields each distinct table with its series, in
 * table order.
 */
export const readTables: (
  tables: ReadonlyArray<DirectoryTable>,
) => Effect.Effect<
  ReadonlyArray<TableSeries>,
  TableLayoutError | AbsUnavailable,
  HttpClient.HttpClient
> = Effect.fn("readTables")(function* (tables: ReadonlyArray<DirectoryTable>) {
  const distinct = [...new Map(tables.map((table) => [table.tableUrl, table])).values()];

  return yield* Effect.forEach(
    distinct,
    (table) =>
      fetchBytes(table.tableUrl.replaceAll(" ", "+")).pipe(
        // The Table names no URL, so the series do not carry it.
        Effect.flatMap((body) =>
          parseTable(body, {
            tableId: table.tableId,
            tableTitle: table.tableTitle,
          }),
        ),
        Effect.map((series) => ({ table, series })),
      ),
    { concurrency: DOWNLOAD_CONCURRENCY },
  );
});
