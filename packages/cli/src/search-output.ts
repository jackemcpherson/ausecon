import type { SeriesIndexEntry } from "@ausecon/core";

import { type OutputFormat, toCsv } from "./output";

/**
 * The CSV columns of `ausecon search`: every field of a series index entry, in
 * the order of the entry.
 */
const CSV_COLUMNS = [
  "publisher",
  "seriesId",
  "title",
  "description",
  "unit",
  "frequency",
  "seriesType",
  "tableNumber",
  "tableTitle",
] as const;

/** A column of the terminal table: its header and the entry field it shows. */
interface TableColumn {
  readonly header: string;
  readonly field: keyof SeriesIndexEntry;
}

/** The terminal table columns, in the order they print. */
const TABLE_COLUMNS: ReadonlyArray<TableColumn> = [
  { header: "SERIES ID", field: "seriesId" },
  { header: "DESCRIPTION", field: "description" },
  { header: "UNIT", field: "unit" },
  { header: "FREQUENCY", field: "frequency" },
  { header: "TABLE", field: "tableNumber" },
];

/** The space between two columns. */
const GUTTER = "  ";

/** The terminal width to fit when the terminal does not report one. */
export const DEFAULT_TERMINAL_WIDTH = 80;

/** The narrowest the description column gets, so a narrow terminal still shows some of it. */
const MIN_DESCRIPTION_WIDTH = 20;

/** Cut text to a width, ending it with an ellipsis when it is cut. */
const truncate = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, width - 1).trimEnd()}…`;

/**
 * Lay out entries as aligned columns with a header row. Only the description
 * shrinks to fit the width; the other columns keep their full width. Lines
 * carry no trailing spaces.
 */
const toTable = (entries: ReadonlyArray<SeriesIndexEntry>, width: number): string => {
  const sized = TABLE_COLUMNS.map((column) => ({
    ...column,
    width: Math.max(column.header.length, ...entries.map((entry) => entry[column.field].length)),
  }));

  const otherWidths = sized
    .filter(({ field }) => field !== "description")
    .reduce((total, column) => total + column.width, GUTTER.length * (sized.length - 1));

  const fitted = sized.map((column) =>
    column.field === "description"
      ? {
          ...column,
          width: Math.min(column.width, Math.max(width - otherWidths, MIN_DESCRIPTION_WIDTH)),
        }
      : column,
  );

  const line = (cell: (column: TableColumn) => string): string =>
    fitted
      .map((column) => truncate(cell(column), column.width).padEnd(column.width))
      .join(GUTTER)
      .trimEnd();

  return [
    line(({ header }) => header),
    ...entries.map((entry) => line(({ field }) => entry[field])),
  ].join("\n");
};

/** How to render search results for stdout. */
export interface SearchRenderOptions {
  /** The format the user chose with `--format`, if any. */
  readonly format: OutputFormat | undefined;
  readonly isTerminal: boolean;
  /** The width of the terminal, in columns. */
  readonly width: number;
}

/**
 * Render series index entries for stdout.
 *
 * With no `--format`, a terminal gets aligned columns (series ID, description,
 * unit, frequency, and RBA table number) cut to the terminal width, and a
 * pipe gets CSV. CSV holds every field of an entry. JSON is the entry list,
 * indented only for a terminal.
 *
 * @param entries - The entries to write.
 * @param options - The chosen format, whether stdout is a terminal, and its width.
 * @returns The text to write to stdout.
 */
export const renderSearchResults = (
  entries: ReadonlyArray<SeriesIndexEntry>,
  options: SearchRenderOptions,
): string =>
  options.format === "json"
    ? JSON.stringify(entries, null, options.isTerminal ? 2 : undefined)
    : options.format === undefined && options.isTerminal
      ? toTable(entries, options.width)
      : toCsv(CSV_COLUMNS, entries);
