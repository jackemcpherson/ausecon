import { Effect, Schema } from "effect";

import { ABS_SERIES_ID_PATTERN, InvalidRequest, type Series, SeriesId } from "./types";

/** A publisher that `ausecon` reads series from: `ABS` or `RBA`. */
export type Publisher = Series["publisher"];

/** A series ID, decoded, with the publisher to read it from. */
export interface ResolvedSeriesId {
  readonly publisher: Publisher;
  readonly seriesId: SeriesId;
}

const PUBLISHER_PREFIX = /^(ABS|RBA):/;

/** The publisher that a series ID's pattern implies. */
const publisherOf = (seriesId: SeriesId): Publisher =>
  ABS_SERIES_ID_PATTERN.test(seriesId) ? "ABS" : "RBA";

/**
 * Resolve a series ID, as the caller writes it, to its publisher.
 *
 * The input is trimmed and upper-cased before it is decoded. A prefix of
 * `abs:` or `rba:`, in any case, names the publisher. Without a prefix, an ID
 * that matches the ABS pattern is an ABS series ID, and every other valid ID
 * is an RBA series ID.
 *
 * The prefix decides only the publisher: `abs:FIRMMCRTD` resolves to the ABS,
 * and `readAbs` then rejects the ID.
 *
 * @param input - A series ID, with or without a publisher prefix.
 * @returns An Effect that yields the publisher and the decoded series ID, or
 * fails with `InvalidRequest` when the input is not a series ID.
 *
 * @example
 * ```typescript
 * const { publisher, seriesId } = yield* resolveSeriesId("firmmcrtd");
 * // publisher: "RBA", seriesId: "FIRMMCRTD"
 * ```
 */
export const resolveSeriesId: (input: string) => Effect.Effect<ResolvedSeriesId, InvalidRequest> =
  Effect.fn("resolveSeriesId")(
    function* (input: string) {
      const normalised = input.trim().toUpperCase();
      const prefix = PUBLISHER_PREFIX.exec(normalised)?.[1];

      const seriesId = yield* Schema.decodeUnknownEffect(SeriesId)(
        normalised.replace(PUBLISHER_PREFIX, ""),
      );

      return {
        publisher: prefix === "ABS" || prefix === "RBA" ? prefix : publisherOf(seriesId),
        seriesId,
      };
    },
    Effect.mapError((error) => new InvalidRequest({ message: error.message })),
  );
