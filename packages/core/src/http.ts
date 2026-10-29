import { Effect, Predicate } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

/**
 * The User-Agent sent with every request to either publisher. The ABS answers
 * 403 to a request without one.
 */
export const USER_AGENT = "ausecon (+https://github.com/jackemcpherson/ausecon)";

/**
 * Describe the error under a failed request: the error description, or the
 * message of the underlying error. `fetch` in Node nests the network error one
 * level down, so its own message is only "fetch failed": the nested message
 * follows it.
 *
 * @param reason - The reason of the Effect HTTP client error.
 * @param fallback - The text to use when the error carries no message.
 * @returns The description.
 */
export const reasonMessage = (
  reason: HttpClientError.HttpClientError["reason"],
  fallback: string,
): string => {
  if (reason.description !== undefined) {
    return reason.description;
  }

  const { cause } = reason;

  const messages = [cause, Predicate.isError(cause) ? cause.cause : undefined].flatMap((error) =>
    Predicate.isError(error) && error.message !== "" ? [error.message] : [],
  );

  return messages.length === 0 ? fallback : messages.join(": ");
};

/**
 * Send a GET request with the caller's `HttpClient` and read the body.
 *
 * The request sends the project User-Agent, follows redirects that the
 * underlying client returns, and fails on any status outside 2xx. Each
 * publisher maps Effect's client errors to its own failures here, at the
 * request, so that no `effect/http` type leaves the library (ADR 0007).
 *
 * @param url - The full request URL.
 * @param body - Read the body of a 2xx response.
 * @param failure - Turn a client error into the publisher's failure.
 * @returns An Effect that yields the body.
 */
export const fetchBody = <A, E>(
  url: string,
  body: (
    response: HttpClientResponse.HttpClientResponse,
  ) => Effect.Effect<A, HttpClientError.HttpClientError>,
  failure: (error: HttpClientError.HttpClientError) => E,
): Effect.Effect<A, E, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.setHeader("user-agent", USER_AGENT)),
      HttpClient.followRedirects(),
      HttpClient.filterStatusOk,
    );

    return yield* client.get(url).pipe(Effect.flatMap(body), Effect.mapError(failure));
  });

/**
 * Read a response body as bytes.
 *
 * @param response - A 2xx response.
 * @returns An Effect that yields the body.
 */
export const bytesBody = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<Uint8Array<ArrayBuffer>, HttpClientError.HttpClientError> =>
  Effect.map(response.arrayBuffer, (body) => new Uint8Array(body));
