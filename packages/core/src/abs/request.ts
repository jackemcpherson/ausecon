import { Effect, Schema } from "effect";

import { AbsRequest, DecodedAbsRequest, InvalidRequest } from "../types";

const FOUR_DIGIT_CATALOGUE_NUMBER = /^\d{4}$/;

const normaliseCatalogueNumber = (catalogueNumber: string): string => {
  const trimmed = catalogueNumber.trim();

  return FOUR_DIGIT_CATALOGUE_NUMBER.test(trimmed) ? `${trimmed}.0` : trimmed;
};

const normaliseCode = (code: string): string => code.trim().toUpperCase();

/**
 * Normalise caller input before schema decoding.
 *
 * Appends `.0` to a four-digit catalogue number and upper-cases table numbers
 * and series IDs.
 */
const normalise: (request: AbsRequest) => AbsRequest = AbsRequest.$match({
  Catalogue: (request) =>
    AbsRequest.Catalogue({
      catalogueNumber: normaliseCatalogueNumber(request.catalogueNumber),
      tableNumbers: (request.tableNumbers ?? []).map(normaliseCode),
    }),
  Series: (request) => AbsRequest.Series({ seriesIds: request.seriesIds.map(normaliseCode) }),
});

/**
 * Normalise and decode a request.
 *
 * @param request - The request as the caller wrote it.
 * @returns An Effect that yields the decoded request, or fails with
 * `InvalidRequest`.
 */
export const decodeRequest = (
  request: AbsRequest,
): Effect.Effect<DecodedAbsRequest, InvalidRequest> =>
  Schema.decodeUnknownEffect(DecodedAbsRequest)(normalise(request)).pipe(
    Effect.mapError((error) => new InvalidRequest({ message: error.message })),
  );
