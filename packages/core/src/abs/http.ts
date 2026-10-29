import { Effect, Match } from "effect";
import type { HttpClient, HttpClientError } from "effect/http";

import { bytesBody, fetchBody, reasonMessage } from "../http";
import { AbsUnavailable, TimeSeriesDirectoryError } from "../types";

/**
 * The most concurrent requests each stage of a read sends to the ABS: the
 * series lookups, the Time Series Directory pages of one query, or the table
 * downloads. It is not a global cap: each series lookup fetches its own pages,
 * so lookups and their pages can send up to this limit squared.
 */
export const ABS_CONCURRENCY = 4;

/**
 * Turn an Effect HTTP client error into the library's own failure, so that no
 * `effect/http` type leaves the library.
 *
 * A request that could not be built, from an invalid URL or a body that would
 * not encode, was never sent. Table URLs come from the Time Series Directory,
 * so it fails with `TimeSeriesDirectoryError`, a fault to report, not a
 * network failure.
 *
 * Any other error fails with `AbsUnavailable`. Only a status error carries a
 * status: a body that fails to arrive is a missing response. A status error's
 * detail names the status. Effect describes every status error alike, so its
 * description adds nothing. Any other detail is the message of the error, such
 * as the `fetch` failure and its nested cause. The tool shows the detail as it
 * is.
 */
const requestFailure = (
  url: string,
  error: HttpClientError.HttpClientError,
): AbsUnavailable | TimeSeriesDirectoryError =>
  Match.value(error.reason).pipe(
    Match.tag(
      "StatusCodeError",
      (reason) =>
        new AbsUnavailable({
          url,
          status: reason.response.status,
          detail: `The ABS answered with status ${reason.response.status}.`,
        }),
    ),
    Match.tag(
      "InvalidUrlError",
      "EncodeError",
      (reason) =>
        new TimeSeriesDirectoryError({
          url,
          reason: `The Time Series Directory lists a URL that cannot be requested: ${reasonMessage(reason, "The request could not be built.")}`,
        }),
    ),
    Match.orElse(
      (reason) =>
        new AbsUnavailable({ url, detail: reasonMessage(reason, "The request got no response.") }),
    ),
  );

/**
 * Fetch an ABS URL as text.
 *
 * @param url - The full request URL.
 * @returns An Effect that yields the body. It fails with `AbsUnavailable`
 * when the request gets no response or a status outside 2xx, and with
 * `TimeSeriesDirectoryError` when the URL cannot be requested.
 */
export const fetchText: (
  url: string,
) => Effect.Effect<string, AbsUnavailable | TimeSeriesDirectoryError, HttpClient.HttpClient> =
  Effect.fn("fetchText")(function* (url: string) {
    return yield* fetchBody(
      url,
      (response) => response.text,
      (error) => requestFailure(url, error),
    );
  });

/**
 * Fetch an ABS URL as bytes.
 *
 * @param url - The full request URL.
 * @returns An Effect that yields the body. It fails with `AbsUnavailable`
 * when the request gets no response or a status outside 2xx, and with
 * `TimeSeriesDirectoryError` when the URL cannot be requested.
 */
export const fetchBytes: (
  url: string,
) => Effect.Effect<
  Uint8Array<ArrayBuffer>,
  AbsUnavailable | TimeSeriesDirectoryError,
  HttpClient.HttpClient
> = Effect.fn("fetchBytes")(function* (url: string) {
  return yield* fetchBody(url, bytesBody, (error) => requestFailure(url, error));
});
