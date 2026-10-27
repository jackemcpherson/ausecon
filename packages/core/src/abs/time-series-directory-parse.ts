import { Effect, Schema } from "effect";
import { XMLParser } from "fast-xml-parser";

/** One series row of the Time Series Directory. */
export interface DirectoryRow {
  readonly releaseDate: string;
  readonly tableUrl: string;
  readonly tableTitle: string;
  readonly tableOrder: number;
  readonly seriesId: string;
}

/** One parsed Time Series Directory page. */
export interface DirectoryPage {
  readonly pageCount: number;
  readonly rows: ReadonlyArray<DirectoryRow>;
}

/** One table of a release, as the Time Series Directory lists it. */
export interface DirectoryTable {
  readonly tableId: string;
  readonly tableTitle: string;
  readonly tableUrl: string;
}

/** A Time Series Directory response that is not a series index. */
export class DirectoryDocumentError extends Schema.TaggedError<DirectoryDocumentError>()(
  "DirectoryDocumentError",
  {
    reason: Schema.String,
  },
) {}

const DIRECTORY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const SeriesElement = Schema.Struct({
  ProductReleaseDate: Schema.String.pipe(Schema.check(Schema.isPattern(DIRECTORY_DATE))),
  TableURL: Schema.String,
  TableTitle: Schema.String,
  TableOrder: Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/))),
  SeriesID: Schema.String,
});

const SeriesIndex = Schema.Struct({
  NumPages: Schema.optionalKey(Schema.String.pipe(Schema.check(Schema.isPattern(/^[1-9]\d*$/)))),
  Series: Schema.optionalKey(Schema.Array(SeriesElement)),
});

// An unknown catalogue number or series ID parses to an empty `TimeSeriesIndex`.
const DirectoryDocument = Schema.Struct({
  TimeSeriesIndex: Schema.optionalKey(Schema.Union([Schema.Literal(""), SeriesIndex])),
  Error: Schema.optionalKey(Schema.String),
});

const parser = new XMLParser({
  ignoreDeclaration: true,
  isArray: (name) => name === "Series",
  parseTagValue: false,
});

/** Convert a `DD/MM/YYYY` directory date to an ISO `YYYY-MM-DD` string. */
const isoDate = (directoryDate: string): string =>
  directoryDate.replace(DIRECTORY_DATE, "$3-$2-$1");

const toRow = (series: typeof SeriesElement.Type): DirectoryRow => ({
  releaseDate: isoDate(series.ProductReleaseDate),
  tableUrl: series.TableURL,
  tableTitle: series.TableTitle,
  tableOrder: Number(series.TableOrder),
  seriesId: series.SeriesID,
});

/**
 * Parse one Time Series Directory page.
 *
 * A page without `NumPages` is the only page. An empty index parses to a page
 * with no rows.
 *
 * @param xml - The response body.
 * @returns An Effect that yields the page, or fails with
 * `DirectoryDocumentError` for an `<Error>` document or an unexpected layout.
 */
export const parseDirectoryPage = (
  xml: string,
): Effect.Effect<DirectoryPage, DirectoryDocumentError> =>
  Effect.try({
    try: () => parser.parse(xml, true),
    catch: (cause) =>
      new DirectoryDocumentError({ reason: `The XML is malformed: ${String(cause)}` }),
  }).pipe(
    Effect.flatMap((document) =>
      Schema.decodeUnknownEffect(DirectoryDocument)(document).pipe(
        Effect.mapError(
          (error) => new DirectoryDocumentError({ reason: `Unexpected layout: ${error.message}` }),
        ),
      ),
    ),
    Effect.flatMap((document) => {
      if (document.Error !== undefined) {
        return Effect.fail(
          new DirectoryDocumentError({
            reason: `The Time Series Directory answered: ${document.Error}`,
          }),
        );
      }

      if (document.TimeSeriesIndex === undefined) {
        return Effect.fail(new DirectoryDocumentError({ reason: "No TimeSeriesIndex element." }));
      }

      if (document.TimeSeriesIndex === "") {
        return Effect.succeed({ pageCount: 1, rows: [] });
      }

      return Effect.succeed({
        pageCount: Number(document.TimeSeriesIndex.NumPages ?? "1"),
        rows: (document.TimeSeriesIndex.Series ?? []).map(toRow),
      });
    }),
  );

/**
 * Keep only rows that link to a spreadsheet.
 *
 * @param rows - Directory rows.
 * @returns The rows with a non-empty `TableURL`.
 */
export const withTableUrl = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryRow> =>
  rows.filter((row) => row.tableUrl.trim() !== "");

/**
 * Keep only rows from the latest release of each table.
 *
 * A table is one `TableURL`, as `readabs` groups it in `read_abs`.
 *
 * @param rows - Directory rows.
 * @returns The rows whose release date is the latest for their table.
 */
export const latestReleases = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryRow> => {
  const latest = new Map<string, string>();

  for (const row of rows) {
    const current = latest.get(row.tableUrl);

    if (current === undefined || row.releaseDate > current) {
      latest.set(row.tableUrl, row.releaseDate);
    }
  }

  return rows.filter((row) => latest.get(row.tableUrl) === row.releaseDate);
};

/** The file name of a table URL without its extension. */
const tableIdOf = (tableUrl: string): string =>
  tableUrl
    .replace(/[?#].*$/, "")
    .replace(/^.*\//, "")
    .replace(/\.[^.]*$/, "");

/**
 * List the distinct tables of directory rows, in row order.
 *
 * @param rows - Directory rows, already filtered to the latest release.
 * @returns One entry per `TableURL`, titled by its first row.
 */
export const tablesOf = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryTable> => {
  const tables = new Map<string, DirectoryTable>();

  for (const row of rows) {
    if (!tables.has(row.tableUrl)) {
      tables.set(row.tableUrl, {
        tableId: tableIdOf(row.tableUrl),
        tableTitle: row.tableTitle,
        tableUrl: row.tableUrl,
      });
    }
  }

  return [...tables.values()];
};
