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
 * The pattern of every ABS series ID, such as `A84423050A`. No RBA series ID
 * matches it.
 */
export const ABS_SERIES_ID_PATTERN = /^[A-Z]\d+[A-Z]$/;

/**
 * A series ID of either publisher, such as `A84423050A` (ABS) or `FIRMMCRTD`
 * (RBA): an upper-case letter, then upper-case letters and digits.
 */
export const SeriesId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z][A-Z0-9]+$/)),
  Schema.brand("SeriesId"),
);

/** A decoded series ID. */
export type SeriesId = typeof SeriesId.Type;

/** A series ID that matches the ABS pattern, such as `A84423050A`. */
export const AbsSeriesId = SeriesId.pipe(Schema.check(Schema.isPattern(ABS_SERIES_ID_PATTERN)));

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
  seriesIds: Schema.NonEmptyArray(AbsSeriesId),
});

/** A decoded series ID request. */
export type SeriesRequest = typeof SeriesRequest.Type;

/** A decoded {@link AbsRequest}. */
export const DecodedAbsRequest = Schema.Union([CatalogueRequest, SeriesRequest]);

/** A decoded {@link AbsRequest}. */
export type DecodedAbsRequest = typeof DecodedAbsRequest.Type;

/**
 * An RBA table number: the identifier in the title of a statistical table,
 * such as `A2`, `F1.1`, `F11.1`, or `B13.2.1`.
 */
export const RbaTableNumber = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z]\d{1,2}(?:\.\d{1,2}){0,2}$/)),
  Schema.brand("RbaTableNumber"),
);

/** A decoded RBA table number. */
export type RbaTableNumber = typeof RbaTableNumber.Type;

/**
 * A request to read RBA statistical tables, as the caller writes it.
 *
 * The `Table` variant reads current tables by RBA table number. The read
 * upper-cases and decodes the table numbers, so `f1.1` finds F1.1.
 */
export type RbaRequest = Data.TaggedEnum<{
  Table: {
    readonly tableNumbers: ReadonlyArray<string>;
  };
}>;

/**
 * Constructors for {@link RbaRequest}.
 *
 * @example
 * ```typescript
 * const cashRate = RbaRequest.Table({ tableNumbers: ["F1"] });
 * ```
 */
export const RbaRequest = Data.taggedEnum<RbaRequest>();

/** A decoded RBA table number request. */
export const RbaTableRequest = Schema.TaggedStruct("Table", {
  tableNumbers: Schema.NonEmptyArray(RbaTableNumber),
});

/** A decoded RBA table number request. */
export type RbaTableRequest = typeof RbaTableRequest.Type;

/** A decoded {@link RbaRequest}. */
export const DecodedRbaRequest = Schema.Union([RbaTableRequest]);

/** A decoded {@link RbaRequest}. */
export type DecodedRbaRequest = typeof DecodedRbaRequest.Type;

/**
 * One table of a release: its table ID and, when known, its ABS title.
 *
 * Table IDs are not unique: two tables in different releases can share a file
 * name and so a table ID. The library tells them apart by table URL internally.
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
 * One ABS series, read from one sheet of a table.
 *
 * The metadata fields come from the rows above the observations. The
 * observations come in row order.
 */
export const AbsSeries = Schema.Struct({
  publisher: Schema.Literal("ABS"),
  seriesId: SeriesId,
  description: Schema.String,
  unit: Schema.String,
  seriesType: Schema.String,
  dataType: Schema.String,
  frequency: Schema.String,
  collectionMonth: Schema.String,
  table: Table,
  sheet: Schema.String,
  observations: Schema.Array(Observation),
});

/** One ABS series, read from one sheet of a table. */
export type AbsSeries = typeof AbsSeries.Type;

/**
 * One statistical table: its RBA table number and title, as the RBA tables
 * page lists them.
 */
export const RbaTable = Schema.Struct({
  tableNumber: RbaTableNumber,
  tableTitle: Schema.String,
});

/** One statistical table. */
export type RbaTable = typeof RbaTable.Type;

/**
 * One RBA series, read from the Data sheet of a statistical table.
 *
 * The metadata fields come from the labelled rows above the observations, with
 * surrounding spaces removed. `publicationDate` is an ISO `YYYY-MM-DD` string.
 * The observations come in row order.
 */
export const RbaSeries = Schema.Struct({
  publisher: Schema.Literal("RBA"),
  seriesId: SeriesId,
  title: Schema.String,
  description: Schema.String,
  unit: Schema.String,
  seriesType: Schema.String,
  frequency: Schema.String,
  source: Schema.String,
  publicationDate: Schema.String,
  table: RbaTable,
  observations: Schema.Array(Observation),
});

/** One RBA series, read from the Data sheet of a statistical table. */
export type RbaSeries = typeof RbaSeries.Type;

/**
 * One sequence of observations of one measure, tagged by its publisher.
 *
 * Every member carries `seriesId`, `description`, `unit`, `seriesType`,
 * `frequency`, `table`, and `observations`. Each publisher adds its own
 * fields.
 */
export const Series = Schema.Union([AbsSeries, RbaSeries]);

/** One sequence of observations of one measure, tagged by its publisher. */
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
 * One or more requested series are missing: the Time Series Directory has no
 * record of them, or the table it names does not hold them.
 */
export class SeriesNotFound extends Schema.TaggedError<SeriesNotFound>()("SeriesNotFound", {
  seriesIds: Schema.Array(SeriesId),
}) {}

/**
 * A request to the ABS got no response, or a status outside 2xx.
 *
 * `status` is present when the ABS answered. `detail` describes the failure
 * as text, such as the status or the network error.
 */
export class AbsUnavailable extends Schema.TaggedError<AbsUnavailable>()("AbsUnavailable", {
  url: Schema.String,
  status: Schema.optionalKey(Schema.Number),
  detail: Schema.String,
}) {}

/**
 * A Time Series Directory fault: a response that is not a series index, such
 * as an error document, malformed XML, or an unexpected layout, or a table URL
 * that cannot be requested.
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

/**
 * A request to the RBA got no response, or a status outside 2xx other than a
 * 404 on a table URL.
 *
 * `status` is present when the RBA answered. `detail` describes the failure
 * as text, such as the status or the network error.
 */
export class RbaUnavailable extends Schema.TaggedError<RbaUnavailable>()("RbaUnavailable", {
  url: Schema.String,
  status: Schema.optionalKey(Schema.Number),
  detail: Schema.String,
}) {}

/**
 * No current statistical table has one or more of the RBA table numbers.
 *
 * Either the series index does not list them, or, when `url` is present, the
 * table URL that the index lists answered 404. Both can mean that the series
 * index is out of date, and the message says so.
 */
export class RbaTableNotFound extends Schema.TaggedError<RbaTableNotFound>()("RbaTableNotFound", {
  tableNumbers: Schema.Array(RbaTableNumber),
  url: Schema.optionalKey(Schema.String),
}) {
  override get message(): string {
    const tables = this.tableNumbers.join(", ");

    const cause =
      this.url === undefined
        ? `No current RBA statistical table has the RBA table number ${tables}.`
        : `The RBA answered 404 for table ${tables} at ${this.url}.`;

    return `${cause} The series index may be out of date: a newer ausecon release may find it.`;
  }
}

/**
 * A statistical table does not have the RBA layout, or the series index lists
 * it as unreadable. `reason` says why.
 */
export class RbaTableLayoutError extends Schema.TaggedError<RbaTableLayoutError>()(
  "RbaTableLayoutError",
  {
    tableNumber: RbaTableNumber,
    url: Schema.String,
    reason: Schema.String,
  },
) {}
