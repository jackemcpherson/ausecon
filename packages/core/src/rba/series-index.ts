import { SERIES_INDEX } from "./series-index-data";

/** One current statistical table that the series index lists. */
export interface IndexedTable {
  /** The RBA table number, such as `F1.1`. */
  readonly tableNumber: string;
  /** The title the RBA tables page gives the table, without its table number. */
  readonly title: string;
  /** The spreadsheet URL. */
  readonly url: string;
  /** The `Last-Modified` header of the spreadsheet when the index was built. */
  readonly lastModified: string;
}

/** A current statistical table that failed to parse when the index was built. */
export interface UnreadableTable extends IndexedTable {
  /** Why the table cannot be read. */
  readonly reason: string;
}

/** One series that the series index lists. */
export interface IndexedSeries {
  readonly seriesId: string;
  readonly title: string;
  readonly description: string;
  readonly unit: string;
  readonly frequency: string;
  readonly seriesType: string;
  /** The RBA table number of the table that holds the series. */
  readonly tableNumber: string;
}

/**
 * The series index: every series ID in the current statistical tables, with
 * the table that holds it (ADR 0010).
 *
 * `tables` and `series` hold the readable tables, in tables page order, and
 * their series, in table order, then sheet and column order. A series ID can
 * appear more than once: the RBA repeats some within a table and across
 * tables. `unreadableTables` holds
 * the tables that failed to parse, with the reason.
 */
export interface SeriesIndex {
  readonly tables: ReadonlyArray<IndexedTable>;
  readonly series: ReadonlyArray<IndexedSeries>;
  readonly unreadableTables: ReadonlyArray<UnreadableTable>;
}

const readableTables = new Map(SERIES_INDEX.tables.map((table) => [table.tableNumber, table]));

const unreadableTables = new Map(
  SERIES_INDEX.unreadableTables.map((table) => [table.tableNumber, table]),
);

/**
 * Find a readable statistical table in the series index.
 *
 * @param tableNumber - The upper-case RBA table number.
 * @returns The table, or `undefined` when the index lists no readable table
 * with that number.
 */
export const findTable = (tableNumber: string): IndexedTable | undefined =>
  readableTables.get(tableNumber);

/**
 * Find a statistical table that the series index lists as unreadable.
 *
 * @param tableNumber - The upper-case RBA table number.
 * @returns The table and the reason, or `undefined`.
 */
export const findUnreadableTable = (tableNumber: string): UnreadableTable | undefined =>
  unreadableTables.get(tableNumber);
