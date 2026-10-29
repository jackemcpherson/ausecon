import { utils, write } from "xlsx";

/** One cell of a synthetic sheet. `null` leaves the cell blank. */
export type SyntheticCell = string | number | null;

/** The rows of a synthetic sheet, from spreadsheet row 1. */
export type SyntheticRows = ReadonlyArray<ReadonlyArray<SyntheticCell>>;

/** The metadata of one series column in a synthetic ABS data sheet. */
export interface SyntheticSeries {
  readonly description: string;
  readonly unit: string;
  readonly seriesType: string;
  readonly dataType: string;
  readonly frequency: string;
  readonly collectionMonth: number;
  readonly seriesId: string;
}

/**
 * Build the rows of a data sheet in the ABS time series layout: the series
 * description in row 1, nine metadata rows ending with `Series ID` in row 10,
 * and observations from row 11.
 *
 * @param series - The series columns, from column B.
 * @param observations - Rows of an Excel serial date, or a note, then values.
 * @returns The sheet rows.
 */
export const absDataSheet = (
  series: ReadonlyArray<SyntheticSeries>,
  observations: SyntheticRows,
): SyntheticRows => [
  [null, ...series.map((column) => column.description)],
  ["Unit", ...series.map((column) => column.unit)],
  ["Series Type", ...series.map((column) => column.seriesType)],
  ["Data Type", ...series.map((column) => column.dataType)],
  ["Frequency", ...series.map((column) => column.frequency)],
  ["Collection Month", ...series.map((column) => column.collectionMonth)],
  ["Series Start", ...series.map(() => 46023)],
  ["Series End", ...series.map(() => 46082)],
  ["No. Obs", ...series.map(() => 3)],
  ["Series ID", ...series.map((column) => column.seriesId)],
  ...observations,
];

/** The metadata of one series column in a synthetic RBA Data sheet. */
export interface SyntheticRbaSeries {
  readonly title: string;
  readonly description: string;
  readonly frequency: string;
  readonly seriesType: string;
  readonly unit: string;
  readonly source: string;
  readonly publicationDate: SyntheticCell;
  readonly seriesId: string;
}

/**
 * Build the rows of a Data sheet in the RBA layout: the table title in row 1,
 * the labelled metadata rows with two blank rows before `Source`, `Series ID`
 * in row 11, and observations from row 12.
 *
 * @param series - The series columns, from column B.
 * @param observations - Rows of a date, as an Excel serial or text, then values.
 * @returns The sheet rows.
 */
export const rbaDataSheet = (
  series: ReadonlyArray<SyntheticRbaSeries>,
  observations: SyntheticRows,
): SyntheticRows => [
  ["Z1 SYNTHETIC TABLE"],
  ["Title", ...series.map((column) => column.title)],
  ["Description", ...series.map((column) => column.description)],
  ["Frequency", ...series.map((column) => column.frequency)],
  ["Type", ...series.map((column) => column.seriesType)],
  ["Units", ...series.map((column) => column.unit)],
  [],
  [],
  ["Source", ...series.map((column) => column.source)],
  ["Publication date", ...series.map((column) => column.publicationDate)],
  ["Series ID", ...series.map((column) => column.seriesId)],
  ...observations,
];

/**
 * Write a synthetic table as an `.xlsx` file.
 *
 * @param sheets - Sheet names and rows, in file order.
 * @returns The `.xlsx` file contents.
 */
export const syntheticTable = (
  sheets: ReadonlyArray<readonly [string, SyntheticRows]>,
): Uint8Array<ArrayBuffer> => {
  const workbook = utils.book_new();

  for (const [name, rows] of sheets) {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows.map((row) => [...row])), name);
  }

  // SAFETY: `write` with `type: "array"` returns an ArrayBuffer.
  const bytes = write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new Uint8Array(bytes);
};
