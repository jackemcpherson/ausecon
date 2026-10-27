import { Effect, Match } from "effect";
import type { HttpClient, HttpClientError } from "effect/http";

import {
  type AbsRequest,
  CatalogueNotFound,
  type CatalogueRequest,
  type DecodedAbsRequest,
  InvalidRequest,
  type Observation,
  type ObservationValue,
  type ReadOptions,
  type SeriesNotFound,
  type SeriesRequest,
  type TableNotFound,
  type WorkbookLayoutError,
} from "../types";
import { readTables } from "./download";
import { decodeRequest } from "./request";
import { fetchDirectory } from "./time-series-directory";
import {
  type DirectoryTable,
  latestReleases,
  tablesOf,
  withTableUrl,
} from "./time-series-directory-parse";

/** Every error a read can fail with. */
export type ReadAbsError =
  | InvalidRequest
  | CatalogueNotFound
  | TableNotFound
  | SeriesNotFound
  | WorkbookLayoutError
  | HttpClientError.HttpClientError;

/**
 * Limit the tables of a catalogue number to the requested table numbers.
 *
 * Table number matching is not built yet, so a request with table numbers
 * fails rather than return tables the caller did not ask for.
 */
const selectTables = (
  request: CatalogueRequest,
  tables: ReadonlyArray<DirectoryTable>,
): Effect.Effect<ReadonlyArray<DirectoryTable>, InvalidRequest | TableNotFound> =>
  request.tableNumbers.length === 0
    ? Effect.succeed(tables)
    : Effect.fail(new InvalidRequest({ message: "Table numbers are not supported yet." }));

/** The tables a catalogue request reads, from the latest release. */
const catalogueTables = (
  request: CatalogueRequest,
): Effect.Effect<
  ReadonlyArray<DirectoryTable>,
  InvalidRequest | CatalogueNotFound | TableNotFound | HttpClientError.HttpClientError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const rows = withTableUrl(yield* fetchDirectory("catno", request.catalogueNumber));

    if (rows.length === 0) {
      return yield* new CatalogueNotFound({ catalogueNumber: request.catalogueNumber });
    }

    return yield* selectTables(request, tablesOf(latestReleases(rows)));
  });

const readCatalogue = (
  request: CatalogueRequest,
): Effect.Effect<ReadonlyArray<Observation>, ReadAbsError, HttpClient.HttpClient> =>
  catalogueTables(request).pipe(Effect.flatMap(readTables));

const readSeries = (
  _request: SeriesRequest,
): Effect.Effect<ReadonlyArray<Observation>, ReadAbsError, HttpClient.HttpClient> =>
  Effect.fail(new InvalidRequest({ message: "Series ID requests are not supported yet." }));

const read = (
  request: AbsRequest,
): Effect.Effect<ReadonlyArray<Observation>, ReadAbsError, HttpClient.HttpClient> =>
  decodeRequest(request).pipe(
    Effect.flatMap(
      Match.type<DecodedAbsRequest>().pipe(
        Match.tag("Catalogue", readCatalogue),
        Match.tag("Series", readSeries),
        Match.exhaustive,
      ),
    ),
  );

const withoutMetadata = (observation: Observation): ObservationValue => ({
  seriesId: observation.seriesId,
  date: observation.date,
  value: observation.value,
});

/**
 * Read ABS time series from the latest release.
 *
 * A `Catalogue` request reads the tables of a catalogue number. A `Series`
 * request reads series IDs. The read queries the Time Series Directory,
 * downloads each table once, and returns one flat list of observations.
 *
 * The Effect requires an `HttpClient`. The library never picks one, so it runs
 * on any runtime. The client must follow redirects, or return them so that
 * the library can follow them.
 *
 * @param request - What to read.
 * @param options - Set `metadata: false` to return only series ID, date, and
 * value.
 * @returns An Effect that yields the observations.
 *
 * @example
 * ```typescript
 * const observations = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" }));
 * ```
 */
export function readAbs(
  request: AbsRequest,
  options: { readonly metadata: false },
): Effect.Effect<ReadonlyArray<ObservationValue>, ReadAbsError, HttpClient.HttpClient>;
export function readAbs(
  request: AbsRequest,
  options?: { readonly metadata?: true },
): Effect.Effect<ReadonlyArray<Observation>, ReadAbsError, HttpClient.HttpClient>;
export function readAbs(
  request: AbsRequest,
  options?: ReadOptions,
): Effect.Effect<
  ReadonlyArray<Observation> | ReadonlyArray<ObservationValue>,
  ReadAbsError,
  HttpClient.HttpClient
>;
export function readAbs(
  request: AbsRequest,
  options?: ReadOptions,
): Effect.Effect<
  ReadonlyArray<Observation> | ReadonlyArray<ObservationValue>,
  ReadAbsError,
  HttpClient.HttpClient
> {
  return options?.metadata === false
    ? read(request).pipe(Effect.map((observations) => observations.map(withoutMetadata)))
    : read(request);
}
