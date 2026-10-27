import { Effect } from "effect";
import {
  type HttpClient,
  HttpClientError,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";

import { absHttpClient } from "./http";
import {
  type DirectoryPage,
  type DirectoryRow,
  parseDirectoryPage,
} from "./time-series-directory-parse";

/** The documented Time Series Directory base URL. */
const DIRECTORY_URL = "https://abs.gov.au/servlet/TSSearchServlet";

/** The most Time Series Directory pages fetched at once. */
const PAGE_CONCURRENCY = 4;

/** A Time Series Directory query: by catalogue number or by series ID. */
export type DirectoryQuery = "catno" | "sid";

const fetchPage = (
  client: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<DirectoryPage, HttpClientError.HttpClientError> =>
  Effect.gen(function* () {
    const response = yield* client.execute(request);
    const xml = yield* response.text;

    return yield* parseDirectoryPage(xml).pipe(
      Effect.mapError((error) => decodeError(request, response, error.reason)),
    );
  });

const decodeError = (
  request: HttpClientRequest.HttpClientRequest,
  response: HttpClientResponse.HttpClientResponse,
  description: string,
): HttpClientError.HttpClientError =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.DecodeError({ request, response, description }),
  });

/**
 * Fetch every Time Series Directory row for one query.
 *
 * Reads `NumPages` from page 1, then fetches the other pages with a small
 * concurrency limit. An unknown catalogue number or series ID yields no rows.
 *
 * @param query - The query parameter, `catno` or `sid`.
 * @param value - The decoded catalogue number or series ID.
 * @returns An Effect that yields the rows of every page, in page order.
 */
export const fetchDirectory = (
  query: DirectoryQuery,
  value: string,
): Effect.Effect<
  ReadonlyArray<DirectoryRow>,
  HttpClientError.HttpClientError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const client = yield* absHttpClient;

    const request = HttpClientRequest.get(DIRECTORY_URL).pipe(
      HttpClientRequest.setUrlParam(query, value),
    );

    const firstPage = yield* fetchPage(client, request);
    const pageNumbers = Array.from({ length: firstPage.pageCount - 1 }, (_, index) => index + 2);

    const otherPages = yield* Effect.forEach(
      pageNumbers,
      (pageNumber) =>
        fetchPage(client, request.pipe(HttpClientRequest.setUrlParam("pg", `${pageNumber}`))),
      { concurrency: PAGE_CONCURRENCY },
    );

    return [firstPage, ...otherPages].flatMap((page) => page.rows);
  });
