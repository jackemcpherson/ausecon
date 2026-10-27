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
 * Options for a read.
 *
 * Set `metadata` to `false` to return only series ID, date, and value.
 */
export interface ReadOptions {
  readonly metadata?: boolean;
}

/**
 * One value of a series for one period, with the series metadata.
 *
 * The fields are the 12 `readabs` columns in camelCase, in the same order.
 */
export const Observation = Schema.Struct({
  tableId: Schema.String,
  sheet: Schema.String,
  tableTitle: Schema.String,
  date: Schema.String,
  seriesDescription: Schema.String,
  value: Schema.Number,
  seriesType: Schema.String,
  dataType: Schema.String,
  collectionMonth: Schema.String,
  frequency: Schema.String,
  seriesId: Schema.String,
  unit: Schema.String,
});

/** One value of a series for one period, with the series metadata. */
export type Observation = typeof Observation.Type;

/** One value of a series for one period, without the series metadata. */
export const ObservationValue = Schema.Struct({
  seriesId: Schema.String,
  date: Schema.String,
  value: Schema.Number,
});

/** One value of a series for one period, without the series metadata. */
export type ObservationValue = typeof ObservationValue.Type;

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
 * A spreadsheet does not have the ABS time series layout.
 *
 * `sheet` is absent when the spreadsheet cannot be opened at all.
 */
export class WorkbookLayoutError extends Schema.TaggedError<WorkbookLayoutError>()(
  "WorkbookLayoutError",
  {
    tableId: Schema.String,
    sheet: Schema.optionalKey(Schema.String),
    reason: Schema.String,
  },
) {}
