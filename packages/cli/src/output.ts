import type { AbsSeries } from "@ausecon/core";

/** An output format of `ausecon abs get`. */
export type OutputFormat = "csv" | "json";

/** The output formats, in the order help lists them. */
export const OUTPUT_FORMATS: ReadonlyArray<OutputFormat> = ["csv", "json"];

/**
 * The CSV columns: the 12 `readabs` columns in camelCase, in the v0.1.0
 * order. The tool owns this list, so a change to the library cannot alter it.
 */
const CSV_COLUMNS = [
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

/** The CSV columns with `--no-metadata`. */
const CSV_COLUMNS_WITHOUT_METADATA = ["seriesId", "date", "value"] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

/** One CSV row: one observation with the metadata of its series. */
type CsvRow = Readonly<Record<CsvColumn, string | number>>;

/** Flatten Series into one row per observation. An absent table title is empty. */
const csvRows = (series: ReadonlyArray<AbsSeries>): ReadonlyArray<CsvRow> =>
  series.flatMap((one) =>
    one.observations.map(({ date, value }): CsvRow => ({
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

/** Quote a CSV field when it holds a comma, a quote, or a line break (RFC 4180). */
const csvField = (value: string | number): string => {
  const text = `${value}`;

  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (columns: ReadonlyArray<CsvColumn>, rows: ReadonlyArray<CsvRow>): string =>
  [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(",")),
  ].join("\n");

/** A Series without its metadata, as `--no-metadata` writes it in JSON. */
const withoutMetadata = ({ seriesId, observations }: AbsSeries) => ({ seriesId, observations });

/** How to render Series for stdout. */
export interface RenderOptions {
  readonly format: OutputFormat;
  readonly hasMetadata: boolean;
  readonly isTerminal: boolean;
}

/**
 * Render Series for stdout.
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
export const renderSeries = (series: ReadonlyArray<AbsSeries>, options: RenderOptions): string =>
  options.format === "csv"
    ? toCsv(options.hasMetadata ? CSV_COLUMNS : CSV_COLUMNS_WITHOUT_METADATA, csvRows(series))
    : JSON.stringify(
        options.hasMetadata ? series : series.map(withoutMetadata),
        null,
        options.isTerminal ? 2 : undefined,
      );
