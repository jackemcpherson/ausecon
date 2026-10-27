import { Observation, ObservationValue } from "@ausecon/core";
import { Struct } from "effect";

/** An output format of `ausecon abs get`. */
export type OutputFormat = "csv" | "json";

/** The output formats, in the order help lists them. */
export const OUTPUT_FORMATS: ReadonlyArray<OutputFormat> = ["csv", "json"];

/** The fields of an observation with metadata, in spec table order. */
export const METADATA_COLUMNS = Struct.keys(Observation.fields);

/** The fields of an observation without metadata. */
export const VALUE_COLUMNS = Struct.keys(ObservationValue.fields);

type Row<Column extends string> = { readonly [Key in Column]: string | number };

/** Quote a CSV field when it holds a comma, a quote, or a line break (RFC 4180). */
const csvField = (value: string | number): string => {
  const text = `${value}`;

  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = <Column extends string>(
  columns: ReadonlyArray<Column>,
  rows: ReadonlyArray<Row<Column>>,
): string =>
  [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvField(row[column])).join(",")),
  ].join("\n");

/**
 * Render observations for stdout.
 *
 * CSV has a header row and one line per observation, with `\n` line endings on
 * every platform. JSON is one array, indented only for a terminal.
 *
 * @param columns - The fields to write, in order.
 * @param rows - The observations.
 * @param format - The output format.
 * @param isTerminal - Whether stdout is a terminal.
 * @returns The text to write to stdout.
 */
export const renderObservations = <Column extends string>(
  columns: ReadonlyArray<Column>,
  rows: ReadonlyArray<Row<Column>>,
  format: OutputFormat,
  isTerminal: boolean,
): string =>
  format === "csv" ? toCsv(columns, rows) : JSON.stringify(rows, null, isTerminal ? 2 : undefined);
