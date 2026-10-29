import { Effect, Schema } from "effect";

import { DecodedRbaRequest, InvalidRequest, RbaRequest } from "../types";

const normaliseCode = (code: string): string => code.trim().toUpperCase();

/** Normalise caller input before schema decoding: upper-case RBA table numbers. */
const normalise: (request: RbaRequest) => RbaRequest = RbaRequest.$match({
  Table: (request) => RbaRequest.Table({ tableNumbers: request.tableNumbers.map(normaliseCode) }),
});

/**
 * Normalise and decode a request.
 *
 * @param request - The request as the caller wrote it.
 * @returns An Effect that yields the decoded request, or fails with
 * `InvalidRequest`.
 */
export const decodeRbaRequest: (
  request: RbaRequest,
) => Effect.Effect<DecodedRbaRequest, InvalidRequest> = Effect.fn("decodeRbaRequest")(
  function* (request: RbaRequest) {
    return yield* Schema.decodeUnknownEffect(DecodedRbaRequest)(normalise(request));
  },
  Effect.mapError((error) => new InvalidRequest({ message: error.message })),
);
