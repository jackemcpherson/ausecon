import { Effect } from "effect";
import type { HttpClient } from "effect/http";

import { type AbsUnavailable, TimeSeriesDirectoryError } from "../types";
import { fetchText } from "./http";
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

/** The URL of one Time Series Directory page. */
const pageUrl = (params: Readonly<Record<string, string>>): string =>
  `${DIRECTORY_URL}?${new URLSearchParams(params).toString()}`;

const fetchPage = (
  url: string,
): Effect.Effect<DirectoryPage, TimeSeriesDirectoryError | AbsUnavailable, HttpClient.HttpClient> =>
  fetchText(url).pipe(
    Effect.flatMap((xml) =>
      parseDirectoryPage(xml).pipe(
        Effect.mapError((error) => new TimeSeriesDirectoryError({ url, reason: error.reason })),
      ),
    ),
  );

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
export const fetchDirectory: (
  query: DirectoryQuery,
  value: string,
) => Effect.Effect<
  ReadonlyArray<DirectoryRow>,
  TimeSeriesDirectoryError | AbsUnavailable,
  HttpClient.HttpClient
> = Effect.fn("fetchDirectory")(function* (query: DirectoryQuery, value: string) {
  const firstPage = yield* fetchPage(pageUrl({ [query]: value }));
  const pageNumbers = Array.from({ length: firstPage.pageCount - 1 }, (_, index) => index + 2);

  const otherPages = yield* Effect.forEach(
    pageNumbers,
    (pageNumber) => fetchPage(pageUrl({ [query]: value, pg: `${pageNumber}` })),
    { concurrency: PAGE_CONCURRENCY },
  );

  return [firstPage, ...otherPages].flatMap((page) => page.rows);
});
