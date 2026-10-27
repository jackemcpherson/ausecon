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
export const parseDirectoryPage: (
  xml: string,
) => Effect.Effect<DirectoryPage, DirectoryDocumentError> = Effect.fn("parseDirectoryPage")(
  function* (xml: string) {
    const parsed = yield* Effect.try({
      try: () => parser.parse(xml, true),
      catch: (cause) =>
        new DirectoryDocumentError({ reason: `The XML is malformed: ${String(cause)}` }),
    });

    const document = yield* Schema.decodeUnknownEffect(DirectoryDocument)(parsed).pipe(
      Effect.mapError(
        (error) => new DirectoryDocumentError({ reason: `Unexpected layout: ${error.message}` }),
      ),
    );

    if (document.Error !== undefined) {
      return yield* new DirectoryDocumentError({
        reason: `The Time Series Directory answered: ${document.Error}`,
      });
    }

    if (document.TimeSeriesIndex === undefined) {
      return yield* new DirectoryDocumentError({ reason: "No TimeSeriesIndex element." });
    }

    if (document.TimeSeriesIndex === "") {
      return { pageCount: 1, rows: [] };
    }

    return {
      pageCount: Number(document.TimeSeriesIndex.NumPages ?? "1"),
      rows: (document.TimeSeriesIndex.Series ?? []).map(toRow),
    };
  },
);
