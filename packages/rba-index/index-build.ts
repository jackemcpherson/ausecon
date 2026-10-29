import { Effect, Result } from "effect";
import type { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";

import { fetchBody } from "../core/src/http";
import { RBA_CONCURRENCY } from "../core/src/rba/http";
import type {
  IndexedSeries,
  IndexedTable,
  SeriesIndex,
  UnreadableTable,
} from "../core/src/rba/series-index";
import { parseRbaTable } from "../core/src/rba/table-parse";
import { TABLES_PAGE, type TableLink, parseTablesPage } from "./tables-page";
import { IndexBuildError, UnreadableTablesChanged } from "./types";

/** A downloaded spreadsheet and its `Last-Modified` header, if the RBA sent one. */
interface Download {
  readonly bytes: Uint8Array;
  readonly lastModified: string | undefined;
}

/** A table after its parse: its series, or the reason it cannot be read. */
interface TableOutcome {
  readonly table: IndexedTable;
  readonly series: Result.Result<ReadonlyArray<IndexedSeries>, string>;
}

/** Send a GET request with the library's request rules, mapping any failure to `IndexBuildError`. */
const download = <A>(
  url: string,
  body: (
    response: HttpClientResponse.HttpClientResponse,
  ) => Effect.Effect<A, HttpClientError.HttpClientError>,
): Effect.Effect<A, IndexBuildError, HttpClient.HttpClient> =>
  fetchBody(url, body, (error) => new IndexBuildError({ url, reason: error.message }));

/** Read a `Last-Modified` header as an ISO timestamp. */
const lastModifiedOf = (
  url: string,
  header: string | undefined,
): Effect.Effect<string, IndexBuildError> => {
  const date = new Date(header ?? "");

  return Number.isNaN(date.getTime())
    ? Effect.fail(
        new IndexBuildError({
          url,
          reason: `The response has no valid Last-Modified header: \`${header ?? ""}\`.`,
        }),
      )
    : Effect.succeed(date.toISOString());
};

/** Download one table and parse it with the library's RBA parser. */
const readTable = (
  link: TableLink,
): Effect.Effect<TableOutcome, IndexBuildError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const { bytes, lastModified } = yield* download(
      link.url,
      (response): Effect.Effect<Download, HttpClientError.HttpClientError> =>
        Effect.map(response.arrayBuffer, (body) => ({
          bytes: new Uint8Array(body),
          lastModified: response.headers["last-modified"],
        })),
    );

    const table: IndexedTable = {
      tableNumber: link.tableNumber,
      title: link.title,
      url: link.url,
      lastModified: yield* lastModifiedOf(link.url, lastModified),
    };

    const parsed = yield* Effect.result(
      parseRbaTable(bytes, { tableNumber: link.tableNumber, tableTitle: link.title }, link.url),
    );

    return {
      table,
      series: Result.map(
        Result.mapError(parsed, (error) => error.reason),
        (series) =>
          series.map((entry): IndexedSeries => ({
            seriesId: entry.seriesId,
            title: entry.title,
            description: entry.description,
            unit: entry.unit,
            frequency: entry.frequency,
            seriesType: entry.seriesType,
            tableNumber: link.tableNumber,
          })),
      ),
    };
  });

/**
 * Build the series index from the current RBA tables.
 *
 * Reads the tables page, downloads every spreadsheet it links to under the
 * library's concurrency limit, and parses each with the library's RBA parser.
 * A table that fails to parse goes into `unreadableTables` with the parser's
 * reason. Tables keep page order, and series keep table order, then sheet and
 * column order.
 *
 * @returns An Effect that yields the index. It fails with `IndexBuildError`
 * when the page or a table cannot be downloaded, a table has no valid
 * `Last-Modified` header, or the page lists no table.
 */
export const buildSeriesIndex: () => Effect.Effect<
  SeriesIndex,
  IndexBuildError,
  HttpClient.HttpClient
> = Effect.fn("buildSeriesIndex")(function* () {
  const page = yield* download(TABLES_PAGE, (response) => response.text);
  const links = yield* parseTablesPage(page);

  const outcomes = yield* Effect.forEach(links, readTable, { concurrency: RBA_CONCURRENCY });

  return {
    tables: outcomes.flatMap(({ table, series }) => (Result.isSuccess(series) ? [table] : [])),
    series: outcomes.flatMap(({ series }) => Result.getOrElse(series, () => [])),
    unreadableTables: outcomes.flatMap(({ table, series }): ReadonlyArray<UnreadableTable> =>
      Result.match(series, {
        onSuccess: () => [],
        onFailure: (reason) => [{ ...table, reason }],
      }),
    ),
  };
});

/**
 * Check a new series index against the committed one.
 *
 * @param index - The new index.
 * @param committed - The index in the library now.
 * @param acceptUnreadable - Accept a changed set of unreadable tables.
 * @returns An Effect that yields the new index. It fails with
 * `UnreadableTablesChanged` when its unreadable tables, by RBA table number,
 * differ from the committed ones, unless `acceptUnreadable` is set.
 */
export const checkUnreadableTables = (
  index: SeriesIndex,
  committed: SeriesIndex,
  acceptUnreadable: boolean,
): Effect.Effect<SeriesIndex, UnreadableTablesChanged> => {
  const numbers = (source: SeriesIndex): ReadonlyArray<string> =>
    source.unreadableTables.map(({ tableNumber }) => tableNumber);

  const now = numbers(index);
  const before = numbers(committed);
  const added = now.filter((tableNumber) => !before.includes(tableNumber));
  const removed = before.filter((tableNumber) => !now.includes(tableNumber));

  return acceptUnreadable || (added.length === 0 && removed.length === 0)
    ? Effect.succeed(index)
    : Effect.fail(new UnreadableTablesChanged({ added, removed }));
};

/**
 * Build the series index and check its unreadable tables against the
 * committed index.
 *
 * @param committed - The index in the library now.
 * @param acceptUnreadable - Accept a changed set of unreadable tables.
 * @returns An Effect that yields the new index.
 */
export const rebuildSeriesIndex = (
  committed: SeriesIndex,
  acceptUnreadable: boolean,
): Effect.Effect<SeriesIndex, IndexBuildError | UnreadableTablesChanged, HttpClient.HttpClient> =>
  buildSeriesIndex().pipe(
    Effect.flatMap((index) => checkUnreadableTables(index, committed, acceptUnreadable)),
  );
