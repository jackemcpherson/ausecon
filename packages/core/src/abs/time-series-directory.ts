import { Effect, Predicate } from "effect";
import type { HttpClient } from "effect/http";

import {
  type AbsUnavailable,
  CatalogueNotFound,
  type CatalogueNumber,
  type SeriesId,
  SeriesNotFound,
  type Table,
  TableId,
  TableNotFound,
  type TableNumber,
  TimeSeriesDirectoryError,
} from "../types";
import { ABS_CONCURRENCY, fetchText } from "./http";
import { titleNamesTable } from "./table-number-parse";
import {
  type DirectoryPage,
  type DirectoryRow,
  parseDirectoryPage,
} from "./time-series-directory-parse";

/** The documented Time Series Directory base URL. */
const DIRECTORY_URL = "https://abs.gov.au/servlet/TSSearchServlet";

/**
 * Tables keyed by table URL, in table order.
 *
 * Table IDs are not unique, so the table URL identifies a table.
 */
export type Tables = ReadonlyMap<string, Table>;

/**
 * The tables that hold requested series, and the series IDs to keep from
 * each.
 *
 * A table can hold more series than were requested, so the read keeps only
 * the series IDs the Directory named for its table URL.
 */
export interface SeriesTables {
  readonly tables: Tables;
  /** The requested series IDs, keyed by the table URL that holds them. */
  readonly seriesIds: ReadonlyMap<string, ReadonlySet<string>>;
}

/** A Time Series Directory query: by catalogue number or by series ID. */
type DirectoryQuery = "catno" | "sid";

/** The URL of one Time Series Directory page. */
const pageUrl = (params: Readonly<Record<string, string>>): string =>
  `${DIRECTORY_URL}?${new URLSearchParams(params).toString()}`;

const fetchPage = (
  url: string,
): Effect.Effect<DirectoryPage, TimeSeriesDirectoryError | AbsUnavailable, HttpClient.HttpClient> =>
  fetchText(url).pipe(
    Effect.flatMap((xml) =>
      parseDirectoryPage(xml).pipe(
        Effect.mapError((error) => new TimeSeriesDirectoryError({ url, reason: error.reason })),
      ),
    ),
  );

/**
 * Fetch every Time Series Directory row for one query.
 *
 * Reads `NumPages` from page 1, then fetches the other pages under the
 * concurrency limit. An unknown catalogue number or series ID yields no rows.
 */
const fetchDirectory = Effect.fn("fetchDirectory")(function* (
  query: DirectoryQuery,
  value: string,
) {
  const firstPage = yield* fetchPage(pageUrl({ [query]: value }));
  const pageNumbers = Array.from({ length: firstPage.pageCount - 1 }, (_, index) => index + 2);

  const otherPages = yield* Effect.forEach(
    pageNumbers,
    (pageNumber) => fetchPage(pageUrl({ [query]: value, pg: `${pageNumber}` })),
    { concurrency: ABS_CONCURRENCY },
  );

  return [firstPage, ...otherPages].flatMap((page) => page.rows);
});

/**
 * Group Directory rows by table URL.
 *
 * `Map.groupBy` keeps first-appearance order and yields no empty group.
 */
const byTableUrl = (
  rows: ReadonlyArray<DirectoryRow>,
): ReadonlyMap<string, ReadonlyArray<DirectoryRow>> => Map.groupBy(rows, (row) => row.tableUrl);

/**
 * Keep only rows with a table URL, from the latest release of each table.
 *
 * A table is one `TableURL`, as `readabs` groups it in `read_abs`. A row with
 * an empty `TableURL` names no table.
 */
const latestRows = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryRow> => {
  const withTable = rows.filter((row) => row.tableUrl.trim() !== "");

  const latestDates = new Map(
    [...byTableUrl(withTable)].map(([tableUrl, group]) => [
      tableUrl,
      group.reduce((latest, row) => (row.releaseDate > latest ? row.releaseDate : latest), ""),
    ]),
  );

  return withTable.filter((row) => latestDates.get(row.tableUrl) === row.releaseDate);
};

/** The table of a Directory row: the file name of its URL, and its title. */
const tableOf = (row: DirectoryRow): Table => ({
  tableId: TableId.make(
    row.tableUrl
      .replace(/[?#].*$/, "")
      .replace(/^.*\//, "")
      .replace(/\.[^.]*$/, ""),
  ),
  tableTitle: row.tableTitle,
});

/**
 * Limit the tables of a release to the requested table numbers.
 *
 * No table numbers keeps every table. Otherwise each table whose title names a
 * requested table number stays, as ADR 0005 records, and any table number that
 * names no table fails with `TableNotFound`.
 *
 * @param tableRows - The first row of each table, one per table URL.
 */
const selectTables = (
  catalogueNumber: CatalogueNumber,
  tableNumbers: ReadonlyArray<TableNumber>,
  tableRows: ReadonlyArray<DirectoryRow>,
): Effect.Effect<ReadonlyArray<DirectoryRow>, TableNotFound> => {
  if (tableNumbers.length === 0) {
    return Effect.succeed(tableRows);
  }

  const titled = (tableNumber: TableNumber) =>
    tableRows.filter((row) => titleNamesTable(row.tableTitle, tableNumber));

  const unmatched = tableNumbers.filter((tableNumber) => titled(tableNumber).length === 0);

  if (unmatched.length > 0) {
    return Effect.fail(new TableNotFound({ catalogueNumber, tableNumbers: unmatched }));
  }

  const selected = new Set(tableNumbers.flatMap(titled));

  return Effect.succeed(tableRows.filter((row) => selected.has(row)));
};

/**
 * The tables of the latest release of a catalogue number, limited to optional
 * table numbers.
 *
 * Each table takes the title of its first row in the latest release.
 *
 * @param catalogueNumber - The decoded catalogue number.
 * @param tableNumbers - The requested table numbers. None reads every table.
 * @returns An Effect that yields the tables by table URL, in Directory order.
 * It fails with `CatalogueNotFound` when no row names a table URL, and with
 * `TableNotFound` when a table number names no table.
 */
export const catalogueTables: (
  catalogueNumber: CatalogueNumber,
  tableNumbers: ReadonlyArray<TableNumber>,
) => Effect.Effect<
  Tables,
  CatalogueNotFound | TableNotFound | TimeSeriesDirectoryError | AbsUnavailable,
  HttpClient.HttpClient
> = Effect.fn("catalogueTables")(function* (
  catalogueNumber: CatalogueNumber,
  tableNumbers: ReadonlyArray<TableNumber>,
) {
  const rows = latestRows(yield* fetchDirectory("catno", catalogueNumber));

  if (rows.length === 0) {
    return yield* new CatalogueNotFound({ catalogueNumber });
  }

  const tableRows = [...byTableUrl(rows).values()].flatMap(([first]) =>
    first === undefined ? [] : [first],
  );

  const selected = yield* selectTables(catalogueNumber, tableNumbers, tableRows);

  return new Map(selected.map((row) => [row.tableUrl, tableOf(row)]));
});

/**
 * The Directory row of the table that holds a series.
 *
 * The row is the lowest `TableOrder` of the latest release, as `readabs` picks
 * it, so no series appears twice. An unknown series ID yields `undefined`.
 */
const seriesRow = (
  seriesId: SeriesId,
): Effect.Effect<
  DirectoryRow | undefined,
  TimeSeriesDirectoryError | AbsUnavailable,
  HttpClient.HttpClient
> =>
  Effect.map(fetchDirectory("sid", seriesId), (rows) =>
    latestRows(rows)
      .toSorted((first, second) => first.tableOrder - second.tableOrder)
      .at(0),
  );

/**
 * The tables that hold series IDs, and the series IDs to keep from each.
 *
 * Looks up each distinct series ID under the concurrency limit.
 *
 * @param seriesIds - The decoded series IDs.
 * @returns An Effect that yields the tables by table URL, in request order,
 * with the series IDs each holds. It fails with one `SeriesNotFound` that
 * names every series ID the Directory lists in no table.
 */
export const seriesTables: (
  seriesIds: ReadonlyArray<SeriesId>,
) => Effect.Effect<
  SeriesTables,
  SeriesNotFound | TimeSeriesDirectoryError | AbsUnavailable,
  HttpClient.HttpClient
> = Effect.fn("seriesTables")(function* (seriesIds: ReadonlyArray<SeriesId>) {
  const found = yield* Effect.forEach(
    new Set(seriesIds),
    (seriesId) => Effect.map(seriesRow(seriesId), (row) => ({ seriesId, row })),
    { concurrency: ABS_CONCURRENCY },
  );

  const missing = found.filter(({ row }) => row === undefined).map(({ seriesId }) => seriesId);

  if (missing.length > 0) {
    return yield* new SeriesNotFound({ seriesIds: missing });
  }

  const rows = found.map(({ row }) => row).filter(Predicate.isNotUndefined);

  return {
    tables: new Map(rows.map((row) => [row.tableUrl, tableOf(row)])),
    seriesIds: new Map(
      [...byTableUrl(rows)].map(([tableUrl, group]) => [
        tableUrl,
        new Set(group.map((row) => row.seriesId)),
      ]),
    ),
  };
});
