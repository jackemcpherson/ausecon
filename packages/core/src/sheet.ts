import { Effect } from "effect";
import { type CellObject, type WorkBook, type WorkSheet, read, utils } from "xlsx";

const MILLISECONDS_PER_DAY = 86_400_000;

/** Excel serial day zero, 1899-12-30, in UTC. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Open a spreadsheet with SheetJS, which reads `.xlsx` and `.xls` alike.
 *
 * Cells keep their raw values: dates stay Excel serial numbers.
 *
 * @param bytes - The file contents.
 * @returns An Effect that yields the workbook, or fails with the SheetJS error
 * as text.
 */
export const openWorkbook = (bytes: Uint8Array): Effect.Effect<WorkBook, string> =>
  Effect.try({
    try: () => read(bytes, { type: "array", cellDates: false, cellHTML: false }),
    catch: String,
  });

/** The cell at a zero-based row and column, if the sheet holds one. */
export const cellAt = (sheet: WorkSheet, row: number, column: number): CellObject | undefined => {
  const cell: CellObject | undefined = sheet[utils.encode_cell({ r: row, c: column })];

  return cell;
};

/** The value of a cell as text. A missing cell is empty. */
export const cellText = (cell: CellObject | undefined): string => String(cell?.v ?? "");

/** The value of a numeric cell. Any other cell has none. */
export const cellNumber = (cell: CellObject | undefined): number | undefined =>
  cell?.t === "n" ? Number(cell.v) : undefined;

/** Convert an Excel serial day number to an ISO `YYYY-MM-DD` date in UTC. */
export const excelSerialToIsoDate = (serial: number): string =>
  new Date(EXCEL_EPOCH + Math.floor(serial) * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);

/** The zero-based rows from `first` to `last`, inclusive. */
export const rowsBetween = (first: number, last: number): ReadonlyArray<number> =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index);
