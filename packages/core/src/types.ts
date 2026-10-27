import { Schema } from "effect";

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
 * The Time Series Directory has no record of one or more requested series.
 */
export class SeriesNotFound extends Schema.TaggedError<SeriesNotFound>()("SeriesNotFound", {
  seriesIds: Schema.Array(SeriesId),
}) {}
