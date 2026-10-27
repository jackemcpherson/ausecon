import { Effect } from "effect";
import type { HttpClient, HttpClientError } from "effect/http";

import type { Observation, WorkbookLayoutError } from "../types";
import { absHttpClient } from "./http";
import type { DirectoryTable } from "./time-series-directory-parse";
import { parseWorkbook } from "./workbook-parse";

/** The most spreadsheets downloaded at once. */
const DOWNLOAD_CONCURRENCY = 4;

/**
 * Download and parse tables.
 *
 * Downloads each distinct `TableURL` once, with a concurrency limit, after
 * replacing spaces in the URL with `+`.
 *
 * @param tables - The tables to read.
 * @returns An Effect that yields the observations of every table, in table
 * order.
 */
export const readTables = (
  tables: ReadonlyArray<DirectoryTable>,
): Effect.Effect<
  ReadonlyArray<Observation>,
  WorkbookLayoutError | HttpClientError.HttpClientError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const client = yield* absHttpClient;
    const distinct = [...new Map(tables.map((table) => [table.tableUrl, table])).values()];

    const workbooks = yield* Effect.forEach(
      distinct,
      (table) =>
        client.get(table.tableUrl.replaceAll(" ", "+")).pipe(
          Effect.flatMap((response) => response.arrayBuffer),
          Effect.flatMap((body) => parseWorkbook(new Uint8Array(body), table)),
        ),
      { concurrency: DOWNLOAD_CONCURRENCY },
    );

    return workbooks.flat();
  });
