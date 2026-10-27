import { Effect } from "effect";
import { type CellObject, type WorkSheet, read, utils } from "xlsx";

import { type Observation, WorkbookLayoutError } from "../types";

/** The table ID and title that each observation of a table carries. */
export interface TableLabels {
  readonly tableId: string;
  readonly tableTitle: string;
}

/** Sheets that `readabs` skips by exact name. */
const SKIPPED_SHEETS = new Set([
  "Index",
  "Inquiries",
  "Enquiries",
  "Contents",
  "Technical note",
  "Technical notes",
  "Note",
  "Notes",
]);

/** `readabs` also skips any sheet whose name contains `Table` and a space. */
const TABLE_SHEET = /Table /;

/** Zero-based row of the `Series ID` label: spreadsheet row 10. */
const SERIES_ID_ROW = 9;

/** Zero-based row of the first observation: spreadsheet row 11. */
const FIRST_OBSERVATION_ROW = 10;

const MILLISECONDS_PER_DAY = 86_400_000;

/** Excel serial day zero, 1899-12-30, in UTC. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** The column A labels of the metadata rows that an observation carries. */
const METADATA_LABELS = {
  unit: "Unit",
  seriesType: "Series Type",
  dataType: "Data Type",
  frequency: "Frequency",
  collectionMonth: "Collection Month",
} as const;

type MetadataField = keyof typeof METADATA_LABELS;

/** The zero-based row of each metadata field in one data sheet. */
type MetadataRows = Readonly<Record<MetadataField, number>>;

/** A data sheet whose layout has been checked. */
interface DataSheet {
  readonly name: string;
  readonly sheet: WorkSheet;
  readonly lastRow: number;
  readonly lastColumn: number;
  readonly metadataRows: MetadataRows;
}

const cellAt = (sheet: WorkSheet, row: number, column: number): CellObject | undefined => {
  const cell: CellObject | undefined = sheet[utils.encode_cell({ r: row, c: column })];

  return cell;
};

const cellText = (cell: CellObject | undefined): string => String(cell?.v ?? "");

const cellNumber = (cell: CellObject | undefined): number | undefined =>
  cell?.t === "n" ? Number(cell.v) : undefined;

/** Convert an Excel serial day number to an ISO `YYYY-MM-DD` date in UTC. */
const excelSerialToIsoDate = (serial: number): string =>
  new Date(EXCEL_EPOCH + Math.floor(serial) * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);

/** Whether `readabs` reads a sheet as data. */
const isDataSheet = (sheetName: string): boolean =>
  !SKIPPED_SHEETS.has(sheetName) && !TABLE_SHEET.test(sheetName);

/**
 * Check that a sheet has the ABS time series layout.
 *
 * Column A of row 10 must hold `Series ID`, and rows 2 to 9 must hold each
 * metadata label that an observation carries.
 */
const checkLayout = (
  sheet: WorkSheet,
  name: string,
  table: TableLabels,
): Effect.Effect<DataSheet, WorkbookLayoutError> => {
  const layoutError = (reason: string): WorkbookLayoutError =>
    new WorkbookLayoutError({ tableId: table.tableId, sheet: name, reason });

  const ref = sheet["!ref"];

  if (ref === undefined || cellText(cellAt(sheet, SERIES_ID_ROW, 0)) !== "Series ID") {
    return Effect.fail(layoutError("Column A of row 10 is not `Series ID`."));
  }

  const labelRows = new Map<string, number>();

  for (let row = 1; row < SERIES_ID_ROW; row += 1) {
    labelRows.set(cellText(cellAt(sheet, row, 0)), row);
  }

  const rowOf = (field: MetadataField): number => labelRows.get(METADATA_LABELS[field]) ?? -1;

  const metadataRows: MetadataRows = {
    unit: rowOf("unit"),
    seriesType: rowOf("seriesType"),
    dataType: rowOf("dataType"),
    frequency: rowOf("frequency"),
    collectionMonth: rowOf("collectionMonth"),
  };

  const missing = Object.entries(metadataRows).flatMap(([field, row]) => (row < 0 ? [field] : []));

  if (missing.length > 0) {
    return Effect.fail(layoutError(`Rows 2 to 9 lack the metadata rows: ${missing.join(", ")}.`));
  }

  const range = utils.decode_range(ref);

  return Effect.succeed({
    name,
    sheet,
    lastRow: range.e.r,
    lastColumn: range.e.c,
    metadataRows,
  });
};

/** Read the observations of one checked data sheet. */
const sheetObservations = (data: DataSheet, table: TableLabels): ReadonlyArray<Observation> => {
  const { sheet, metadataRows } = data;
  const dates = new Map<number, string>();

  for (let row = FIRST_OBSERVATION_ROW; row <= data.lastRow; row += 1) {
    // Only a date in column A marks a period. A text note, such as
    // `Trend Break` or `see ...`, is not one.
    const serial = cellNumber(cellAt(sheet, row, 0));

    if (serial !== undefined) {
      dates.set(row, excelSerialToIsoDate(serial));
    }
  }

  const observations: Array<Observation> = [];

  for (let column = 1; column <= data.lastColumn; column += 1) {
    const seriesId = cellText(cellAt(sheet, SERIES_ID_ROW, column));

    if (seriesId === "") {
      continue;
    }

    const metadata = (field: MetadataField): string =>
      cellText(cellAt(sheet, metadataRows[field], column));

    const seriesDescription = cellText(cellAt(sheet, 0, column));
    const seriesType = metadata("seriesType");
    const dataType = metadata("dataType");
    const collectionMonth = metadata("collectionMonth");
    const frequency = metadata("frequency");
    const unit = metadata("unit");

    for (const [row, date] of dates) {
      const value = cellNumber(cellAt(sheet, row, column));

      if (value !== undefined) {
        observations.push({
          tableId: table.tableId,
          sheet: data.name,
          tableTitle: table.tableTitle,
          date,
          seriesDescription,
          value,
          seriesType,
          dataType,
          collectionMonth,
          frequency,
          seriesId,
          unit,
        });
      }
    }
  }

  return observations;
};

/**
 * Read the observations of an ABS time series table.
 *
 * Skips the sheets `readabs` skips. Each data sheet must have `Series ID` in
 * column A of row 10. Rows without a date in column A, such as `Trend Break`
 * notes, and blank or text value cells are left out. Dates come from Excel
 * serial numbers, which is how `.xlsx` stores date cells.
 *
 * @param bytes - The `.xlsx` file contents.
 * @param table - The table ID and title to put on each observation.
 * @returns An Effect that yields the observations, or fails with
 * `WorkbookLayoutError`.
 */
export const parseTable = (
  bytes: Uint8Array,
  table: TableLabels,
): Effect.Effect<ReadonlyArray<Observation>, WorkbookLayoutError> =>
  Effect.try({
    try: () => read(bytes, { type: "array", cellDates: false, cellHTML: false }),
    catch: (cause) =>
      new WorkbookLayoutError({
        tableId: table.tableId,
        reason: `The table cannot be opened as .xlsx: ${String(cause)}`,
      }),
  }).pipe(
    // SheetJS adds sheets in file order, so entry order is sheet order.
    Effect.flatMap((workbook) =>
      Effect.forEach(
        Object.entries(workbook.Sheets).filter(([name]) => isDataSheet(name)),
        ([name, sheet]) => checkLayout(sheet, name, table),
      ),
    ),
    Effect.map((sheets) => sheets.flatMap((data) => sheetObservations(data, table))),
  );
