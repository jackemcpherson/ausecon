import { readFileSync } from "node:fs";

import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

/** A response that the fixture client serves for one URL. */
export interface RecordedResponse {
  readonly status: number;
  readonly body: string | Uint8Array<ArrayBuffer>;
  readonly headers?: Readonly<Record<string, string>>;
}

/** One request that reached the fixture client. */
export interface RecordedRequest {
  readonly url: string;
  readonly userAgent: string | undefined;
}

/** A fixture `HttpClient` layer and the log of requests it received. */
export interface FixtureHttpClient {
  readonly layer: Layer.Layer<HttpClient.HttpClient>;
  readonly requests: ReadonlyArray<RecordedRequest>;
}

/** The Time Series Directory base URL that the library requests. */
export const TIME_SERIES_DIRECTORY = "https://abs.gov.au/servlet/TSSearchServlet";

/** The release folder of the Wage Price Index (`6345.0`) tables. */
export const WAGE_PRICE_INDEX_RELEASE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release/";

/** The table IDs of every Wage Price Index (`6345.0`) table, in recorded order. */
export const WAGE_PRICE_INDEX_TABLE_IDS = [
  "634501",
  "634502a",
  "634502b",
  "634503a",
  "634503b",
  "634504a",
  "634504b",
  "634505a",
  "634505b",
  "634507a",
  "634507b",
  "634508a",
  "634508b",
  "634509a",
  "634509b",
  "63450table2ato9a",
  "63450table2bto9b",
] as const;

/**
 * Read a recorded file from `packages/testkit/fixtures/`.
 *
 * @param file - The file name inside the fixtures directory.
 * @returns The file contents.
 */
export const fixtureBytes = (file: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(readFileSync(new URL(`fixtures/${file}`, import.meta.url)));

/**
 * Serve a recorded fixture file with HTTP status 200.
 *
 * @param file - The file name inside the fixtures directory.
 * @returns The recorded response.
 */
export const recorded = (file: string): RecordedResponse => ({
  status: 200,
  body: fixtureBytes(file),
});

/**
 * Build the Time Series Directory URL for a query, as the library sends it.
 *
 * @param query - The query parameters, in the order the library sets them.
 * @returns The full request URL.
 */
export const directoryUrl = (query: Readonly<Record<string, string>>): string =>
  `${TIME_SERIES_DIRECTORY}?${new URLSearchParams(query).toString()}`;

/**
 * Responses for a full read of the Wage Price Index (`6345.0`): ten Time
 * Series Directory pages and all 17 tables.
 *
 * @returns The responses keyed by request URL.
 */
export const wagePriceIndexResponses = (): ReadonlyMap<string, RecordedResponse> =>
  new Map([
    [directoryUrl({ catno: "6345.0" }), recorded("directory-6345.0-p1.xml")],
    ...Array.from({ length: 9 }, (_, index): [string, RecordedResponse] => [
      directoryUrl({ catno: "6345.0", pg: `${index + 2}` }),
      recorded(`directory-6345.0-p${index + 2}.xml`),
    ]),
    ...WAGE_PRICE_INDEX_TABLE_IDS.map((tableId): [string, RecordedResponse] => [
      `${WAGE_PRICE_INDEX_RELEASE}${tableId}.xlsx`,
      recorded(`${tableId}.xlsx`),
    ]),
  ]);

/**
 * Build an `HttpClient` layer that serves recorded responses by URL.
 *
 * A request for a URL without a recorded response fails the test with a
 * defect. The returned log lists every request in the order it arrived.
 *
 * @param responses - The recorded responses keyed by full request URL.
 * @returns The layer and its request log.
 */
export const fixtureHttpClient = (
  responses: ReadonlyMap<string, RecordedResponse>,
): FixtureHttpClient => {
  const requests: Array<RecordedRequest> = [];

  const client = HttpClient.make((request, url) => {
    const key = url.toString();
    const response = responses.get(key);

    requests.push({ url: key, userAgent: request.headers["user-agent"] });

    return response === undefined
      ? Effect.die(`The fixture HttpClient has no recorded response for ${key}`)
      : Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(response.body, {
              status: response.status,
              headers: response.headers ?? {},
            }),
          ),
        );
  });

  return { layer: Layer.succeed(HttpClient.HttpClient, client), requests };
};
