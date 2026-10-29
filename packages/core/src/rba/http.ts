import { Effect, Match } from "effect";
import type { HttpClient, HttpClientError } from "effect/http";

import { bytesBody, fetchBody, reasonMessage } from "../http";
import { RbaTableNotFound, RbaUnavailable, type RbaTableNumber } from "../types";

/** The most concurrent table downloads a read sends to the RBA. */
export const RBA_CONCURRENCY = 4;

/**
 * Turn an Effect HTTP client error into the library's own failure, so that no
 * `effect/http` type leaves the library.
 *
 * A 404 fails with `RbaTableNotFound`: the table URL came from the series
 * index, so the index may be out of date. Any other error fails with
 * `RbaUnavailable`, as the ABS mapping does. A URL that cannot be requested
 * also fails with `RbaUnavailable`, without a status: the index has no
 * failure of its own, and the build checks its URLs.
 */
const requestFailure = (
  url: string,
  tableNumber: RbaTableNumber,
  error: HttpClientError.HttpClientError,
): RbaTableNotFound | RbaUnavailable =>
  Match.value(error.reason).pipe(
    Match.tag("StatusCodeError", (reason) =>
      reason.response.status === 404
        ? new RbaTableNotFound({ tableNumbers: [tableNumber], url })
        : new RbaUnavailable({
            url,
            status: reason.response.status,
            detail: `The RBA answered with status ${reason.response.status}.`,
          }),
    ),
    Match.orElse(
      (reason) =>
        new RbaUnavailable({ url, detail: reasonMessage(reason, "The request got no response.") }),
    ),
  );

/**
 * Download a statistical table as bytes.
 *
 * @param url - The table URL from the series index.
 * @param tableNumber - The RBA table number, for a 404.
 * @returns An Effect that yields the file. It fails with `RbaTableNotFound`
 * on a 404, and with `RbaUnavailable` when the request gets no response or
 * any other status outside 2xx.
 */
export const fetchTable: (
  url: string,
  tableNumber: RbaTableNumber,
) => Effect.Effect<
  Uint8Array<ArrayBuffer>,
  RbaTableNotFound | RbaUnavailable,
  HttpClient.HttpClient
> = Effect.fn("fetchTable")(function* (url: string, tableNumber: RbaTableNumber) {
  return yield* fetchBody(url, bytesBody, (error) => requestFailure(url, tableNumber, error));
});
