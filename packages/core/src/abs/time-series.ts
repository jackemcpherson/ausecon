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
  type SeriesId,
  SeriesNotFound,
  type SeriesRequest,
  TableNotFound,
  type WorkbookLayoutError,
} from "../types";
import { readTables } from "./download";
import { titleNamesTable } from "./table-number-parse";
import { decodeRequest } from "./request";
import { fetchDirectory } from "./time-series-directory";
import {
  type DirectoryRow,
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
 * A request without table numbers reads every table. Otherwise the read keeps
 * each table whose title names a requested table number, as ADR 0005 records,
 * and fails with `TableNotFound` if any requested table number names no table.
 */
const selectTables = (
  request: CatalogueRequest,
  tables: ReadonlyArray<DirectoryTable>,
): Effect.Effect<ReadonlyArray<DirectoryTable>, TableNotFound> => {
  if (request.tableNumbers.length === 0) {
    return Effect.succeed(tables);
  }

  const unmatched = request.tableNumbers.filter(
    (tableNumber) => !tables.some((table) => titleNamesTable(table.tableTitle, tableNumber)),
  );

  return unmatched.length > 0
    ? Effect.fail(
        new TableNotFound({ catalogueNumber: request.catalogueNumber, tableNumbers: unmatched }),
      )
    : Effect.succeed(
        tables.filter((table) =>
          request.tableNumbers.some((tableNumber) =>
            titleNamesTable(table.tableTitle, tableNumber),
          ),
        ),
      );
};

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

/** The most series IDs looked up in the Time Series Directory at once. */
const SERIES_CONCURRENCY = 4;

/**
 * The directory row a series is read from: the lowest `TableOrder` of the
 * latest release, as `readabs` picks it, so no series appears twice.
 */
const seriesRow = (
  seriesId: SeriesId,
): Effect.Effect<
  readonly [SeriesId, DirectoryRow | undefined],
  HttpClientError.HttpClientError,
  HttpClient.HttpClient
> =>
  fetchDirectory("sid", seriesId).pipe(
    Effect.map((rows) => [
      seriesId,
      latestReleases(withTableUrl(rows)).reduce<DirectoryRow | undefined>(
        (first, row) => (first === undefined || row.tableOrder < first.tableOrder ? row : first),
        undefined,
      ),
    ]),
  );

const readSeries = (
  request: SeriesRequest,
): Effect.Effect<ReadonlyArray<Observation>, ReadAbsError, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const found = yield* Effect.forEach(new Set(request.seriesIds), seriesRow, {
      concurrency: SERIES_CONCURRENCY,
    });

    const missing = found.flatMap(([seriesId, row]) => (row === undefined ? [seriesId] : []));

    if (missing.length > 0) {
      return yield* new SeriesNotFound({ seriesIds: missing });
    }

    const rows = found.flatMap(([, row]) => (row === undefined ? [] : [row]));
    const tables = tablesOf(rows);
    const tableIds = new Map(tables.map((table) => [table.tableUrl, table.tableId]));
    const wanted = new Set(rows.map((row) => `${tableIds.get(row.tableUrl)} ${row.seriesId}`));
    const observations = yield* readTables(tables);

    return observations.filter((observation) =>
      wanted.has(`${observation.tableId} ${observation.seriesId}`),
    );
  });

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
