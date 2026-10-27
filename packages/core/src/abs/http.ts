import { Effect, Match, Predicate } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

import { AbsUnavailable } from "../types";

/**
 * The User-Agent sent with every request. The ABS answers 403 to a request
 * without one.
 */
export const USER_AGENT = "ausecon (+https://github.com/jackemcpherson/ausecon)";

/**
 * Turn an Effect HTTP client error into the library's own failure, so that no
 * `effect/http` type leaves the library. Only a status error carries a status:
 * a body that fails to arrive is a missing response. The cause text is the
 * error description, or the message of the underlying error, such as the
 * `fetch` failure.
 */
const unavailable = (url: string, error: HttpClientError.HttpClientError): AbsUnavailable =>
  Match.value(error.reason).pipe(
    Match.tag(
      "StatusCodeError",
      (reason) =>
        new AbsUnavailable({
          url,
          status: reason.response.status,
          cause: reason.description ?? `The ABS answered with status ${reason.response.status}.`,
        }),
    ),
    Match.orElse(
      (reason) =>
        new AbsUnavailable({
          url,
          cause:
            reason.description ??
            (Predicate.isError(reason.cause)
              ? reason.cause.message
              : "The request got no response."),
        }),
    ),
  );

/**
 * Send a GET request to the ABS with the caller's `HttpClient` and read the
 * body.
 *
 * The request sends the project User-Agent, follows redirects that the
 * underlying client returns, and fails on any status outside 2xx.
 */
const fetchBody = <A>(
  url: string,
  body: (
    response: HttpClientResponse.HttpClientResponse,
  ) => Effect.Effect<A, HttpClientError.HttpClientError>,
): Effect.Effect<A, AbsUnavailable, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.setHeader("user-agent", USER_AGENT)),
      HttpClient.followRedirects(),
      HttpClient.filterStatusOk,
    );

    return yield* client.get(url).pipe(
      Effect.flatMap(body),
      Effect.mapError((error) => unavailable(url, error)),
    );
  });

/**
 * Fetch an ABS URL as text.
 *
 * @param url - The full request URL.
 * @returns An Effect that yields the body, or fails with `AbsUnavailable`.
 */
export const fetchText = (
  url: string,
): Effect.Effect<string, AbsUnavailable, HttpClient.HttpClient> =>
  fetchBody(url, (response) => response.text);

/**
 * Fetch an ABS URL as bytes.
 *
 * @param url - The full request URL.
 * @returns An Effect that yields the body, or fails with `AbsUnavailable`.
 */
export const fetchBytes = (
  url: string,
): Effect.Effect<Uint8Array<ArrayBuffer>, AbsUnavailable, HttpClient.HttpClient> =>
  fetchBody(url, (response) => Effect.map(response.arrayBuffer, (body) => new Uint8Array(body)));
