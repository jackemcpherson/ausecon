import type { AbsSeries, RbaSeries, Series } from "@ausecon/core";

/** An output format of the `get` commands. */
export type OutputFormat = "csv" | "json";

/** The output formats, in the order help lists them. */
export const OUTPUT_FORMATS: ReadonlyArray<OutputFormat> = ["csv", "json"];

/**
 * The ABS CSV columns: the 12 `readabs` columns in camelCase, in the v0.1.0
 * order. The tool owns this list, so a change to the library cannot alter it.
 */
const ABS_COLUMNS = [
  "tableId",
  "sheet",
  "tableTitle",
  "date",
  "seriesDescription",
  "value",
  "seriesType",
  "dataType",
  "collectionMonth",
  "frequency",
  "seriesId",
  "unit",
] as const;

/**
 * The columns that fit a series from either publisher: the ABS columns that
 * an RBA series also fills, in the ABS order.
 */
const SHARED_COLUMNS = [
  "tableTitle",
  "date",
  "seriesDescription",
  "value",
  "seriesType",
  "frequency",
  "seriesId",
  "unit",
] as const;

/** The RBA CSV columns: the RBA table number, the shared columns, then the RBA metadata. */
const RBA_COLUMNS = [
  "tableNumber",
  ...SHARED_COLUMNS,
  "title",
  "source",
  "publicationDate",
] as const;

/**
 * The CSV columns of `ausecon get`: the publisher, the table that holds the
 * series, then the shared columns. `table` holds an ABS table ID or an RBA
 * table number.
 */
const SERIES_COLUMNS = ["publisher", "table", ...SHARED_COLUMNS] as const;

/** The CSV columns with `--no-metadata`, for either publisher. */
const COLUMNS_WITHOUT_METADATA = ["seriesId", "date", "value"] as const;

type AbsColumn = (typeof ABS_COLUMNS)[number];

type RbaColumn = (typeof RBA_COLUMNS)[number];

type SeriesColumn = (typeof SERIES_COLUMNS)[number];

/** One CSV row, such as one observation with the metadata of its series. */
export type CsvRow<Column extends string> = Readonly<Record<Column, string | number>>;

/** Flatten ABS Series into one row per observation. An absent table title is empty. */
const absRows = (series: ReadonlyArray<AbsSeries>): ReadonlyArray<CsvRow<AbsColumn>> =>
  series.flatMap((one) =>
    one.observations.map(({ date, value }): CsvRow<AbsColumn> => ({
      tableId: one.table.tableId,
      sheet: one.sheet,
      tableTitle: one.table.tableTitle ?? "",
      date,
      seriesDescription: one.description,
      value,
      seriesType: one.seriesType,
      dataType: one.dataType,
      collectionMonth: one.collectionMonth,
      frequency: one.frequency,
      seriesId: one.seriesId,
      unit: one.unit,
    })),
  );

/** Flatten RBA Series into one row per observation. An absent publication date is empty. */
const rbaRows = (series: ReadonlyArray<RbaSeries>): ReadonlyArray<CsvRow<RbaColumn>> =>
  series.flatMap((one) =>
    one.observations.map(({ date, value }): CsvRow<RbaColumn> => ({
      tableNumber: one.table.tableNumber,
      tableTitle: one.table.tableTitle,
      date,
      seriesDescription: one.description,
      value,
      seriesType: one.seriesType,
      frequency: one.frequency,
      seriesId: one.seriesId,
      unit: one.unit,
      title: one.title,
      source: one.source,
      publicationDate: one.publicationDate ?? "",
    })),
  );

/**
 * Flatten Series from either publisher into one row per observation. An
 * absent ABS table title is empty.
 */
const seriesRows = (series: ReadonlyArray<Series>): ReadonlyArray<CsvRow<SeriesColumn>> =>
  series.flatMap((one) => {
    const [table, tableTitle] =
      one.publisher === "ABS"
        ? [one.table.tableId, one.table.tableTitle ?? ""]
        : [one.table.tableNumber, one.table.tableTitle];

    return one.observations.map(({ date, value }): CsvRow<SeriesColumn> => ({
      publisher: one.publisher,
      table,
      tableTitle,
      date,
      seriesDescription: one.description,
      value,
      seriesType: one.seriesType,
      frequency: one.frequency,
      seriesId: one.seriesId,
      unit: one.unit,
    }));
  });

/** Quote a CSV field when it holds a comma, a quote, or a line break (RFC 4180). */
const csvField = (value: string | number): string => {
  const text = `${value}`;

  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Write CSV: a header row of the columns, then one line per row, with `\n` line endings. */
export const toCsv = <Column extends string>(
  columns: ReadonlyArray<Column>,
  rows: ReadonlyArray<CsvRow<Column>>,
): string =>
  [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(",")),
  ].join("\n");

/** A Series without its metadata, as `--no-metadata` writes it in JSON. */
const withoutMetadata = ({ seriesId, observations }: Series) => ({
  seriesId,
  observations,
});

/** How to render Series for stdout. */
export interface RenderOptions {
  readonly format: OutputFormat;
  readonly hasMetadata: boolean;
  readonly isTerminal: boolean;
}

/** Render Series as JSON: the Series list, indented only for a terminal. */
const toJson = (series: ReadonlyArray<Series>, options: RenderOptions): string =>
  JSON.stringify(
    options.hasMetadata ? series : series.map(withoutMetadata),
    null,
    options.isTerminal ? 2 : undefined,
  );

/**
 * Render ABS Series for stdout.
 *
 * CSV has a header row and one line per observation, with `\n` line endings on
 * every platform. JSON is the Series list, indented only for a terminal.
 * Without metadata, CSV holds series ID, date, and value, and each JSON Series
 * holds only its series ID and observations.
 *
 * @param series - The Series to write.
 * @param options - The output format, whether to write metadata, and whether
 * stdout is a terminal.
 * @returns The text to write to stdout.
 */
export const renderAbsSeries = (
  series: ReadonlyArray<AbsSeries>,
  options: RenderOptions,
): string =>
  options.format === "json"
    ? toJson(series, options)
    : options.hasMetadata
      ? toCsv(ABS_COLUMNS, absRows(series))
      : toCsv(COLUMNS_WITHOUT_METADATA, absRows(series));

/**
 * Render RBA Series for stdout.
 *
 * CSV writes the RBA table number, the shared columns, then `title`,
 * `source`, and `publicationDate`. Every other rule is that of {@link renderAbsSeries}.
 *
 * @param series - The Series to write.
 * @param options - The output format, whether to write metadata, and whether
 * stdout is a terminal.
 * @returns The text to write to stdout.
 */
export const renderRbaSeries = (
  series: ReadonlyArray<RbaSeries>,
  options: RenderOptions,
): string =>
  options.format === "json"
    ? toJson(series, options)
    : options.hasMetadata
      ? toCsv(RBA_COLUMNS, rbaRows(series))
      : toCsv(COLUMNS_WITHOUT_METADATA, rbaRows(series));

/**
 * Render Series from either publisher for stdout.
 *
 * CSV writes `publisher`, then `table` (the ABS table ID or the RBA table
 * number), then the shared columns, so one header fits both publishers. Every
 * other rule is that of {@link renderAbsSeries}.
 *
 * @param series - The Series to write.
 * @param options - The output format, whether to write metadata, and whether
 * stdout is a terminal.
 * @returns The text to write to stdout.
 */
export const renderSeries = (series: ReadonlyArray<Series>, options: RenderOptions): string =>
  options.format === "json"
    ? toJson(series, options)
    : options.hasMetadata
      ? toCsv(SERIES_COLUMNS, seriesRows(series))
      : toCsv(COLUMNS_WITHOUT_METADATA, seriesRows(series));
