import { Data, Schema } from "effect";

/**
 * An ABS catalogue number, such as `6202.0` or `6291.0.55.001`.
 */
export const CatalogueNumber = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^\d{4}\.\d(?:\.\d{2}\.\d{3})?$/)),
  Schema.brand("CatalogueNumber"),
);

/** A decoded ABS catalogue number. */
export type CatalogueNumber = typeof CatalogueNumber.Type;

/**
 * An ABS series ID, such as `A84423050A`.
 */
export const SeriesId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z]\d+[A-Z]$/)),
  Schema.brand("SeriesId"),
);

/** A decoded ABS series ID. */
export type SeriesId = typeof SeriesId.Type;

/**
 * The number in the ABS title of a table, such as `1`, `5a`, `X28`, or
 * `021_MTH`.
 */
export const TableNumber = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z]?\d+[A-Za-z]?(?:_[A-Za-z0-9]+)?$/)),
  Schema.brand("TableNumber"),
);

/** A decoded ABS table number. */
export type TableNumber = typeof TableNumber.Type;

/**
 * An ABS table ID: the file name of a table without its extension, such as
 * `6202001` or `62020x28`.
 */
export const TableId = Schema.String.pipe(Schema.brand("TableId"));

/** An ABS table ID. */
export type TableId = typeof TableId.Type;

/**
 * A request to read ABS time series, as the caller writes it.
 *
 * The `Catalogue` variant reads the latest release of a catalogue number,
 * optionally limited to some table numbers. The `Series` variant reads one or
 * more series IDs. The read normalises and decodes these strings, so `6345`
 * and lower-case series IDs are accepted.
 */
export type AbsRequest = Data.TaggedEnum<{
  Catalogue: {
    readonly catalogueNumber: string;
    readonly tableNumbers?: ReadonlyArray<string>;
  };
  Series: {
    readonly seriesIds: ReadonlyArray<string>;
  };
}>;

/**
 * Constructors for {@link AbsRequest}.
 *
 * @example
 * ```typescript
 * const wages = AbsRequest.Catalogue({ catalogueNumber: "6345.0" });
 * const series = AbsRequest.Series({ seriesIds: ["A2603039T"] });
 * ```
 */
export const AbsRequest = Data.taggedEnum<AbsRequest>();

/** A decoded catalogue number request. */
export const CatalogueRequest = Schema.TaggedStruct("Catalogue", {
  catalogueNumber: CatalogueNumber,
  tableNumbers: Schema.Array(TableNumber),
});

/** A decoded catalogue number request. */
export type CatalogueRequest = typeof CatalogueRequest.Type;

/** A decoded series ID request. */
export const SeriesRequest = Schema.TaggedStruct("Series", {
  seriesIds: Schema.NonEmptyArray(SeriesId),
});

/** A decoded series ID request. */
export type SeriesRequest = typeof SeriesRequest.Type;

/** A decoded {@link AbsRequest}. */
export const DecodedAbsRequest = Schema.Union([CatalogueRequest, SeriesRequest]);

/** A decoded {@link AbsRequest}. */
export type DecodedAbsRequest = typeof DecodedAbsRequest.Type;

/**
 * One table of a release: its table ID and, when known, its ABS title.
 *
 * Table IDs are not unique: two tables in different releases can share a file
 * name and so a table ID. The read tells them apart by table URL internally.
 */
export const Table = Schema.Struct({
  tableId: TableId,
  tableTitle: Schema.optionalKey(Schema.String),
});

/** One table of a release. */
export type Table = typeof Table.Type;

/**
 * One value of a series for one period.
 *
 * `date` is an ISO `YYYY-MM-DD` string, so time zones never shift a period.
 */
export const Observation = Schema.Struct({
  date: Schema.String,
  value: Schema.Number,
});

/** One value of a series for one period. */
export type Observation = typeof Observation.Type;

/**
 * One sequence of observations of one measure, read from one sheet of a table.
 *
 * The metadata fields come from the rows above the observations. The
 * observations come in row order.
 */
export const Series = Schema.Struct({
  seriesId: SeriesId,
  seriesDescription: Schema.String,
  unit: Schema.String,
  seriesType: Schema.String,
  dataType: Schema.String,
  frequency: Schema.String,
  collectionMonth: Schema.String,
  table: Table,
  sheet: Schema.String,
  observations: Schema.Array(Observation),
});

/** One sequence of observations of one measure, read from one sheet of a table. */
export type Series = typeof Series.Type;

/**
 * The request input failed schema decoding.
 */
export class InvalidRequest extends Schema.TaggedError<InvalidRequest>()("InvalidRequest", {
  message: Schema.String,
}) {}

/**
 * The Time Series Directory has no series for the catalogue number.
 */
export class CatalogueNotFound extends Schema.TaggedError<CatalogueNotFound>()(
  "CatalogueNotFound",
  {
    catalogueNumber: CatalogueNumber,
  },
) {}

/**
 * One or more requested table numbers match no table title.
 */
export class TableNotFound extends Schema.TaggedError<TableNotFound>()("TableNotFound", {
  catalogueNumber: CatalogueNumber,
  tableNumbers: Schema.Array(TableNumber),
}) {}

/**
 * The Time Series Directory has no record of one or more requested series.
 */
export class SeriesNotFound extends Schema.TaggedError<SeriesNotFound>()("SeriesNotFound", {
  seriesIds: Schema.Array(SeriesId),
}) {}

/**
 * A request to the ABS got no response, or a status outside 2xx.
 *
 * `status` is present when the ABS answered. `cause` describes the failure.
 */
export class AbsUnavailable extends Schema.TaggedError<AbsUnavailable>()("AbsUnavailable", {
  url: Schema.String,
  status: Schema.optionalKey(Schema.Number),
  cause: Schema.String,
}) {}

/**
 * A Time Series Directory response is not a series index: an error document,
 * malformed XML, or an unexpected layout.
 */
export class TimeSeriesDirectoryError extends Schema.TaggedError<TimeSeriesDirectoryError>()(
  "TimeSeriesDirectoryError",
  {
    url: Schema.String,
    reason: Schema.String,
  },
) {}

/**
 * A table does not have the ABS time series layout.
 *
 * `sheet` is absent when the table cannot be opened as `.xlsx` at all.
 */
export class TableLayoutError extends Schema.TaggedError<TableLayoutError>()("TableLayoutError", {
  tableId: TableId,
  sheet: Schema.optionalKey(Schema.String),
  reason: Schema.String,
}) {}
