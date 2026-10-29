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

/**
 * The column A labels of the row that holds the series IDs. Most tables use
 * `Series ID`. D10 and A5 use `Mnemonic`.
 */
const SERIES_ID_LABELS: ReadonlyArray<string> = ["Series ID", "Mnemonic"];

/** The column A labels of the metadata rows that every series carries. */
const METADATA_LABELS = {
  title: "Title",
  description: "Description",
  frequency: "Frequency",
  seriesType: "Type",
  unit: "Units",
  source: "Source",
} as const;

/** The column A label of the publication date row, which the C tables lack. */
const PUBLICATION_DATE_LABEL = "Publication date";

type MetadataField = keyof typeof METADATA_LABELS;

/** The zero-based row of each metadata field in a data sheet. */
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

/** A sheet with a series ID row in column A: a data sheet, before its layout is checked. */
interface CandidateSheet {
  readonly sheet: WorkSheet;
  /** The zero-based row and column of the sheet's last cell. */
  readonly lastRow: number;
  readonly lastColumn: number;
  /** The zero-based series ID row and its label. */
  readonly seriesIdRow: number;
  readonly seriesIdLabel: string;
}

/** A data sheet, with its layout checked. */
interface DataSheet {
  readonly sheet: WorkSheet;
  readonly metadataRows: MetadataRows;
  /** The zero-based column, series ID, and ISO publication date, if any, of each series. */
  readonly seriesColumns: ReadonlyArray<readonly [number, SeriesId, Option.Option<string>]>;
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

/** The trimmed text of column A in a zero-based row. */
const columnA = (sheet: WorkSheet, row: number): string => cellText(cellAt(sheet, row, 0)).trim();

/**
 * Find the series ID row of a sheet.
 *
 * @returns The sheet and its first row whose column A holds a series ID
 * label, or nothing when the sheet has no cells or no such row, as a Notes
 * sheet does.
 */
const candidateSheet = (sheet: WorkSheet | undefined): Option.Option<CandidateSheet> => {
  const ref = sheet?.["!ref"];

  if (sheet === undefined || ref === undefined) {
    return Option.none();
  }

  const range = utils.decode_range(ref);

  return Option.fromUndefinedOr(
    rowsBetween(0, range.e.r).find((row) => SERIES_ID_LABELS.includes(columnA(sheet, row))),
  ).pipe(
    Option.map((seriesIdRow) => ({
      sheet,
      lastRow: range.e.r,
      lastColumn: range.e.c,
      seriesIdRow,
      seriesIdLabel: columnA(sheet, seriesIdRow),
    })),
  );
};

/**
 * Check that a data sheet has the RBA layout.
 *
 * Column A must hold each metadata label in a row above the series ID row.
 * A `Publication date` row is optional. Each filled cell of the series ID row
 * must hold a series ID, and the Publication date cell above it, if the row
 * exists, a date. Below the series ID row, column A must hold a date or a
 * blank.
 */
const checkLayout = (
  candidate: CandidateSheet,
  layoutError: (reason: string) => RbaTableLayoutError,
): Effect.Effect<DataSheet, RbaTableLayoutError> => {
  const { sheet, seriesIdRow, seriesIdLabel } = candidate;

  // The first row with a label wins.
  const labelRows = new Map(
    rowsBetween(0, seriesIdRow - 1)
      .toReversed()
      .map((row) => [columnA(sheet, row), row]),
  );

  const rowOf = (label: string): Option.Option<number> =>
    Option.fromUndefinedOr(labelRows.get(label));

  const fieldRow = (field: MetadataField): Option.Option<number> => rowOf(METADATA_LABELS[field]);

  const metadataRows = Option.all({
    title: fieldRow("title"),
    description: fieldRow("description"),
    frequency: fieldRow("frequency"),
    seriesType: fieldRow("seriesType"),
    unit: fieldRow("unit"),
    source: fieldRow("source"),
  });

  if (Option.isNone(metadataRows)) {
    const missing = Struct.keys(METADATA_LABELS)
      .filter((field) => Option.isNone(fieldRow(field)))
      .map((field) => `\`${METADATA_LABELS[field]}\``);

    return Effect.fail(
      layoutError(`Column A above \`${seriesIdLabel}\` lacks the rows: ${missing.join(", ")}.`),
    );
  }

  const observationRows = rowsBetween(seriesIdRow + 1, candidate.lastRow);

  const unexpectedRow = observationRows.find(
    (row) => columnA(sheet, row) !== "" && cellIsoDate(cellAt(sheet, row, 0)) === undefined,
  );

  if (unexpectedRow !== undefined) {
    return Effect.fail(
      layoutError(
        `Cell ${address(unexpectedRow, 0)} holds \`${columnA(sheet, unexpectedRow)}\`, which is not a date or a blank.`,
      ),
    );
  }

  const periods = observationRows.flatMap((row) => {
    const date = cellIsoDate(cellAt(sheet, row, 0));

    return date === undefined ? [] : [[row, date] as const];
  });

  const publicationDateRow = rowOf(PUBLICATION_DATE_LABEL);

  const seriesIdCells = rowsBetween(1, candidate.lastColumn).flatMap((column) => {
    const text = cellText(cellAt(sheet, seriesIdRow, column)).trim();

    return text === "" ? [] : [[column, text] as const];
  });

  const publicationDateOf = (
    column: number,
  ): Effect.Effect<Option.Option<string>, RbaTableLayoutError> =>
    Option.match(publicationDateRow, {
      onNone: () => Effect.succeedNone,
      onSome: (row) => {
        const cell = cellAt(sheet, row, column);
        const date = cellIsoDate(cell);

        return date === undefined
          ? Effect.fail(
              layoutError(
                `Cell ${address(row, column)} holds \`${cellText(cell)}\`, which is not a publication date.`,
              ),
            )
          : Effect.succeedSome(date);
      },
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

      return [column, seriesId, yield* publicationDateOf(column)] as const;
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

/** Read the series of a checked data sheet, in column order. */
const sheetSeries = (data: DataSheet, table: RbaTable): ReadonlyArray<RbaSeries> => {
  const { sheet, metadataRows } = data;

  return data.seriesColumns.map(([column, seriesId, publicationDate]): RbaSeries => {
    const metadata = (field: MetadataField): string =>
      cellText(cellAt(sheet, metadataRows[field], column)).trim();

    const series: RbaSeries = {
      publisher: "RBA",
      seriesId,
      title: metadata("title"),
      description: metadata("description"),
      unit: metadata("unit"),
      seriesType: metadata("seriesType"),
      frequency: metadata("frequency"),
      source: metadata("source"),
      table,
      observations: data.periods.flatMap(([row, date]) => {
        const value = cellNumber(cellAt(sheet, row, column));

        return value === undefined ? [] : [{ date, value }];
      }),
    };

    return Option.match(publicationDate, {
      onNone: () => series,
      onSome: (date) => ({ ...series, publicationDate: date }),
    });
  });
};

/**
 * Read the series of an RBA statistical table.
 *
 * Reads every sheet whose column A holds a `Series ID` or `Mnemonic` row, in
 * sheet order, and skips the rest, such as Notes. Most tables have one such
 * sheet, `Data`. Finds the metadata rows by the label in column A, all above
 * the series ID row: Title, Description, Frequency, Type, Units, Source, and,
 * if present, Publication date. Each filled cell of the series ID row starts
 * one series. Observations start on the row after it. Column A dates are Excel
 * serial numbers or `dd-Mon-yyyy` or `dd/mm/yyyy` text, and become ISO dates.
 * Blank and text value cells give no observation. Metadata text is kept as the
 * RBA wrote it, apart from surrounding spaces, so a Frequency of `See notes`
 * stays `See notes`.
 *
 * @param bytes - The `.xlsx` or `.xls` file contents.
 * @param table - The RbaTable to put on each series.
 * @param url - The table URL, for failures.
 * @returns An Effect that yields the series in sheet order, then column
 * order, or fails with `RbaTableLayoutError`.
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

    const candidates = file.SheetNames.flatMap((name) =>
      Option.match(candidateSheet(file.Sheets[name]), {
        onNone: () => [],
        onSome: (candidate) => [[name, candidate] as const],
      }),
    );

    if (candidates.length === 0) {
      return yield* layoutError(
        `No sheet has a ${SERIES_ID_LABELS.map((label) => `\`${label}\``).join(" or ")} row in column A.`,
      );
    }

    const sheets = yield* Effect.forEach(candidates, ([name, candidate]) =>
      checkLayout(candidate, (reason) => layoutError(`Sheet \`${name}\`: ${reason}`)),
    );

    return sheets.flatMap((data) => sheetSeries(data, table));
  },
);
