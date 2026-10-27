import { Effect } from "effect";
import type { HttpClient, HttpClientError } from "effect/http";

import type { Series, WorkbookLayoutError } from "../types";
import { absHttpClient } from "./http";
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
  WorkbookLayoutError | HttpClientError.HttpClientError,
  HttpClient.HttpClient
> = Effect.fn("readTables")(function* (tables: ReadonlyArray<DirectoryTable>) {
  const client = yield* absHttpClient;
  const distinct = [...new Map(tables.map((table) => [table.tableUrl, table])).values()];

  return yield* Effect.forEach(
    distinct,
    (table) =>
      client.get(table.tableUrl.replaceAll(" ", "+")).pipe(
        Effect.flatMap((response) => response.arrayBuffer),
        // The Table names no URL, so the series do not carry it.
        Effect.flatMap((body) =>
          parseTable(new Uint8Array(body), {
            tableId: table.tableId,
            tableTitle: table.tableTitle,
          }),
        ),
        Effect.map((series) => ({ table, series })),
      ),
    { concurrency: DOWNLOAD_CONCURRENCY },
  );
});
