import { Effect, Option, Schema, Struct } from "effect";
import { type CellObject, type WorkSheet, utils } from "xlsx";

import {
  cellAt,
  cellNumber,
  cellText,
  excelSerialToIsoDate,
  openWorkbook,
  rowsBetween,
} from "../sheet";
import { type RbaSeries, type RbaTable, RbaTableLayoutError, SeriesId } from "../types";

/** The only sheet the parser reads. Notes and other sheets are skipped. */
const DATA_SHEET = "Data";

/** The column A label of the row that holds the series IDs. */
const SERIES_ID_LABEL = "Series ID";

/** The column A labels of the metadata rows that a series carries. */
const METADATA_LABELS = {
  title: "Title",
  description: "Description",
  frequency: "Frequency",
  seriesType: "Type",
  unit: "Units",
  source: "Source",
  publicationDate: "Publication date",
} as const;

type MetadataField = keyof typeof METADATA_LABELS;

/** The zero-based row of each metadata field in the Data sheet. */
type MetadataRows = Readonly<Record<MetadataField, number>>;

/** The month numbers of the month abbreviations in `dd-Mon-yyyy` dates. */
const MONTHS = new Map(
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
    (month, index) => [month, index + 1],
  ),
);

/** A text date such as `01-Oct-2026`. */
const MONTH_NAME_DATE = /^(\d{1,2})-([A-Z][a-z]{2})-(\d{4})$/;

/** A text date such as `01/10/2026`. */
const NUMERIC_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** The Data sheet of a table, with its layout checked. */
interface DataSheet {
  readonly sheet: WorkSheet;
  readonly metadataRows: MetadataRows;
  /** The zero-based column, series ID, and ISO publication date of each series. */
  readonly seriesColumns: ReadonlyArray<readonly [number, SeriesId, string]>;
  /** The zero-based row and ISO date of each period. */
  readonly periods: ReadonlyArray<readonly [number, string]>;
}

/**
 * Build an ISO date from its parts, or nothing when the parts name no day of
 * the calendar, such as 31 February.
 */
const isoDate = (year: number, month: number, day: number): string | undefined => {
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : undefined;
};

/** Read a `dd-Mon-yyyy` or `dd/mm/yyyy` text date as an ISO date. */
const textToIsoDate = (text: string): string | undefined => {
  const monthName = MONTH_NAME_DATE.exec(text);

  if (monthName !== null) {
    const [, day = "", month = "", year = ""] = monthName;

    const monthNumber = MONTHS.get(month);

    return monthNumber === undefined ? undefined : isoDate(Number(year), monthNumber, Number(day));
  }

  const numeric = NUMERIC_DATE.exec(text);

  if (numeric !== null) {
    const [, day = "", month = "", year = ""] = numeric;

    return isoDate(Number(year), Number(month), Number(day));
  }

  return undefined;
};

/** Read a cell that holds an Excel serial date or a text date as an ISO date. */
const cellIsoDate = (cell: CellObject | undefined): string | undefined => {
  const serial = cellNumber(cell);

  return serial === undefined ? textToIsoDate(cellText(cell).trim()) : excelSerialToIsoDate(serial);
};

/** The spreadsheet address of a zero-based row and column, such as `B11`. */
const address = (row: number, column: number): string => utils.encode_cell({ r: row, c: column });

/**
 * Check that a Data sheet has the RBA layout.
 *
 * Column A must hold `Series ID` in some row, and each metadata label in a row
 * above it. Each filled cell of the Series ID row must hold a series ID, and
 * the Publication date cell above it a date. Below the Series ID row, column A
 * must hold a date or a blank.
 */
const checkLayout = (
  sheet: WorkSheet,
  ref: string,
  layoutError: (reason: string) => RbaTableLayoutError,
): Effect.Effect<DataSheet, RbaTableLayoutError> => {
  const range = utils.decode_range(ref);
  const rows = rowsBetween(0, range.e.r);
  const columnA = (row: number): string => cellText(cellAt(sheet, row, 0)).trim();
  const seriesIdRow = rows.find((row) => columnA(row) === SERIES_ID_LABEL);

  if (seriesIdRow === undefined) {
    return Effect.fail(layoutError(`Column A has no \`${SERIES_ID_LABEL}\` row.`));
  }

  // The first row with a label wins.
  const labelRows = new Map(
    rowsBetween(0, seriesIdRow - 1)
      .toReversed()
      .map((row) => [columnA(row), row]),
  );

  const rowOf = (field: MetadataField): Option.Option<number> =>
    Option.fromUndefinedOr(labelRows.get(METADATA_LABELS[field]));

  const metadataRows = Option.all({
    title: rowOf("title"),
    description: rowOf("description"),
    frequency: rowOf("frequency"),
    seriesType: rowOf("seriesType"),
    unit: rowOf("unit"),
    source: rowOf("source"),
    publicationDate: rowOf("publicationDate"),
  });

  if (Option.isNone(metadataRows)) {
    const missing = Struct.keys(METADATA_LABELS)
      .filter((field) => Option.isNone(rowOf(field)))
      .map((field) => `\`${METADATA_LABELS[field]}\``);

    return Effect.fail(
      layoutError(`Column A above \`${SERIES_ID_LABEL}\` lacks the rows: ${missing.join(", ")}.`),
    );
  }

  const observationRows = rowsBetween(seriesIdRow + 1, range.e.r);

  const unexpectedRow = observationRows.find(
    (row) => columnA(row) !== "" && cellIsoDate(cellAt(sheet, row, 0)) === undefined,
  );

  if (unexpectedRow !== undefined) {
    return Effect.fail(
      layoutError(
        `Cell ${address(unexpectedRow, 0)} holds \`${columnA(unexpectedRow)}\`, which is not a date or a blank.`,
      ),
    );
  }

  const periods = observationRows.flatMap((row) => {
    const date = cellIsoDate(cellAt(sheet, row, 0));

    return date === undefined ? [] : [[row, date] as const];
  });

  const publicationDateRow = metadataRows.value.publicationDate;

  const seriesIdCells = rowsBetween(1, range.e.c).flatMap((column) => {
    const text = cellText(cellAt(sheet, seriesIdRow, column)).trim();

    return text === "" ? [] : [[column, text] as const];
  });

  return Effect.forEach(seriesIdCells, ([column, text]) =>
    Effect.gen(function* () {
      const seriesId = yield* Schema.decodeUnknownEffect(SeriesId)(text).pipe(
        Effect.mapError(() =>
          layoutError(
            `Cell ${address(seriesIdRow, column)} holds \`${text}\`, which is not a series ID.`,
          ),
        ),
      );

      const publicationCell = cellAt(sheet, publicationDateRow, column);
      const publicationDate = cellIsoDate(publicationCell);

      if (publicationDate === undefined) {
        return yield* layoutError(
          `Cell ${address(publicationDateRow, column)} holds \`${cellText(publicationCell)}\`, which is not a publication date.`,
        );
      }

      return [column, seriesId, publicationDate] as const;
    }),
  ).pipe(
    Effect.map((seriesColumns) => ({
      sheet,
      metadataRows: metadataRows.value,
      seriesColumns,
      periods,
    })),
  );
};

/** Read the series of a checked Data sheet, in column order. */
const sheetSeries = (data: DataSheet, table: RbaTable): ReadonlyArray<RbaSeries> => {
  const { sheet, metadataRows } = data;

  return data.seriesColumns.map(([column, seriesId, publicationDate]): RbaSeries => {
    const metadata = (field: MetadataField): string =>
      cellText(cellAt(sheet, metadataRows[field], column)).trim();

    return {
      publisher: "RBA",
      seriesId,
      title: metadata("title"),
      description: metadata("description"),
      unit: metadata("unit"),
      seriesType: metadata("seriesType"),
      frequency: metadata("frequency"),
      source: metadata("source"),
      publicationDate,
      table,
      observations: data.periods.flatMap(([row, date]) => {
        const value = cellNumber(cellAt(sheet, row, column));

        return value === undefined ? [] : [{ date, value }];
      }),
    };
  });
};

/**
 * Read the series of an RBA statistical table.
 *
 * Reads the Data sheet only. Finds the metadata rows by the label in column A:
 * Title, Description, Frequency, Type, Units, Source, and Publication date,
 * all above the Series ID row. Each filled cell of the Series ID row starts one
 * series. Observations start on the row after it. Column A dates are Excel
 * serial numbers or `dd-Mon-yyyy` or `dd/mm/yyyy` text, and become ISO dates.
 * Blank and text value cells give no observation. Metadata text is kept as the
 * RBA wrote it, apart from surrounding spaces, so a Frequency of `See notes`
 * stays `See notes`.
 *
 * @param bytes - The `.xlsx` or `.xls` file contents.
 * @param table - The RbaTable to put on each series.
 * @param url - The table URL, for failures.
 * @returns An Effect that yields the series in column order, or fails with
 * `RbaTableLayoutError`.
 */
export const parseRbaTable: (
  bytes: Uint8Array,
  table: RbaTable,
  url: string,
) => Effect.Effect<ReadonlyArray<RbaSeries>, RbaTableLayoutError> = Effect.fn("parseRbaTable")(
  function* (bytes: Uint8Array, table: RbaTable, url: string) {
    const layoutError = (reason: string): RbaTableLayoutError =>
      new RbaTableLayoutError({ tableNumber: table.tableNumber, url, reason });

    const file = yield* openWorkbook(bytes).pipe(
      Effect.mapError((cause) =>
        layoutError(`The table cannot be opened as a spreadsheet: ${cause}`),
      ),
    );

    const sheet = file.Sheets[DATA_SHEET];
    const ref = sheet?.["!ref"];

    if (sheet === undefined || ref === undefined) {
      return yield* layoutError(`The table has no \`${DATA_SHEET}\` sheet with cells.`);
    }

    return sheetSeries(yield* checkLayout(sheet, ref, layoutError), table);
  },
);
