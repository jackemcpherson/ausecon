import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

/**
 * The User-Agent sent with every request. The ABS answers 403 to a request
 * without one.
 */
export const USER_AGENT = "ausecon (+https://github.com/jackemcpherson/ausecon)";

/**
 * The caller's `HttpClient`, set up for ABS requests.
 *
 * It sends the project User-Agent, follows redirects that the underlying
 * client returns, and fails on any status outside 2xx.
 */
export const absHttpClient: Effect.Effect<HttpClient.HttpClient, never, HttpClient.HttpClient> =
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    return client.pipe(
      HttpClient.mapRequest(HttpClientRequest.setHeader("user-agent", USER_AGENT)),
      HttpClient.followRedirects(),
      HttpClient.filterStatusOk,
    );
  });
