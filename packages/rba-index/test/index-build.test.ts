import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  RBA_TABLES,
  RBA_TABLES_PAGE,
  RBA_TABLES_PAGE_FILE,
  type RecordedResponse,
  type SyntheticRbaSeries,
  fixtureHttpClient,
  rbaDataSheet,
  rbaTableResponses,
  recorded,
  syntheticTable,
} from "@ausecon/testkit";

import type { SeriesIndex } from "../../core/src/rba/series-index";
import { rebuildSeriesIndex } from "../index-build";
import { renderSeriesIndex } from "../index-source";
import { IndexBuildError, UnreadableTablesChanged } from "../types";

const LAST_MODIFIED = "Wed, 28 Oct 2026 21:04:53 GMT";

const E3_URL = `${RBA_TABLES}e03hist.xls`;
const F3_URL = `${RBA_TABLES}f03hist.xlsx`;

const F3_SERIES: SyntheticRbaSeries = {
  title: "Synthetic yield",
  description: "Synthetic yield; 3 years",
  frequency: "Monthly",
  seriesType: "Original",
  unit: "Per cent",
  source: "RBA",
  publicationDate: 46295,
  seriesId: "ZSYNYLD3",
};

// E3 holds distribution tables by survey year, with no series ID row.
const E3_TABLE = syntheticTable([
  ["2018", [["E3 DISTRIBUTION"], ["Quintile", "Share"], ["Lowest", 0.1]]],
  ["Notes", [["Notes"]]],
]);

const withLastModified = (response: RecordedResponse): RecordedResponse => ({
  ...response,
  headers: { "last-modified": LAST_MODIFIED },
});

/** The trimmed tables page, the recorded D9, F1, and F1.1, and synthetic E3 and F3. */
const responses = (
  overrides: ReadonlyArray<readonly [string, RecordedResponse]> = [],
): ReadonlyMap<string, RecordedResponse> =>
  new Map([
    [RBA_TABLES_PAGE, recorded(RBA_TABLES_PAGE_FILE)],
    ...[...rbaTableResponses()].map(([url, response]): [string, RecordedResponse] => [
      url,
      withLastModified(response),
    ]),
    [E3_URL, withLastModified({ status: 200, body: E3_TABLE })],
    [
      F3_URL,
      withLastModified({
        status: 200,
        body: syntheticTable([["Data", rbaDataSheet([F3_SERIES], [[46022, 4.1]])]]),
      }),
    ],
    ...overrides,
  ]);

const E3_REASON = "No sheet has a `Series ID` or `Mnemonic` row in column A.";

const committedIndex = (unreadable: ReadonlyArray<string>): SeriesIndex => ({
  tables: [],
  series: [],
  unreadableTables: unreadable.map((tableNumber) => ({
    tableNumber,
    title: "Committed",
    url: `${RBA_TABLES}${tableNumber}.xls`,
    lastModified: "2020-01-01T00:00:00.000Z",
    reason: "Committed reason.",
  })),
});

const rebuild = (
  committed: SeriesIndex,
  acceptUnreadable: boolean,
  overrides: ReadonlyArray<readonly [string, RecordedResponse]> = [],
) => {
  const http = fixtureHttpClient(responses(overrides));

  return rebuildSeriesIndex(committed, acceptUnreadable).pipe(
    Effect.provide(http.layer),
    Effect.map((index) => ({ index, requests: http.requests })),
  );
};

describe("rebuildSeriesIndex on the recorded tables page", () => {
  it.effect("lists the readable tables in page order with titles, URLs, and Last-Modified", () =>
    Effect.gen(function* () {
      const { index } = yield* rebuild(committedIndex(["E3"]), false);

      expect(index.tables).toEqual([
        {
          tableNumber: "D9",
          title: "Rural Debt by Lender",
          url: `${RBA_TABLES}d09hist.xls`,
          lastModified: "2026-10-28T21:04:53.000Z",
        },
        {
          tableNumber: "F1",
          title: "Interest Rates and Yields – Money Market – Daily",
          url: `${RBA_TABLES}f01d.xlsx`,
          lastModified: "2026-10-28T21:04:53.000Z",
        },
        {
          tableNumber: "F1.1",
          title: "Interest Rates and Yields – Money Market – Monthly",
          url: `${RBA_TABLES}f01hist.xlsx`,
          lastModified: "2026-10-28T21:04:53.000Z",
        },
        {
          // The link text spans two attributes and lines on the page.
          tableNumber: "F3",
          title: "Aggregate Measures of Australian Corporate Bond Yields",
          url: F3_URL,
          lastModified: "2026-10-28T21:04:53.000Z",
        },
      ]);
    }),
  );

  it.effect("lists every series in table order, then column order", () =>
    Effect.gen(function* () {
      const { index } = yield* rebuild(committedIndex(["E3"]), false);
      const tableNumbers = index.series.map(({ tableNumber }) => tableNumber);

      expect(tableNumbers.filter((tableNumber) => tableNumber === "D9")).toHaveLength(5);
      expect(tableNumbers.filter((tableNumber) => tableNumber === "F1")).toHaveLength(17);
      expect(tableNumbers.filter((tableNumber) => tableNumber === "F1.1")).toHaveLength(15);
      expect(tableNumbers).toEqual(tableNumbers.toSorted());

      expect(index.series).toContainEqual({
        seriesId: "FIRMMCRTD",
        title: "Cash Rate Target",
        description: "Cash Rate Target on date",
        unit: "Per cent",
        frequency: "Daily",
        seriesType: "Original",
        tableNumber: "F1",
      });

      expect(index.series.at(-1)).toEqual({
        seriesId: "ZSYNYLD3",
        title: "Synthetic yield",
        description: "Synthetic yield; 3 years",
        unit: "Per cent",
        frequency: "Monthly",
        seriesType: "Original",
        tableNumber: "F3",
      });
    }),
  );

  it.effect("lists a table that fails to parse as unreadable, with the parser's reason", () =>
    Effect.gen(function* () {
      const { index } = yield* rebuild(committedIndex(["E3"]), false);

      expect(index.unreadableTables).toEqual([
        {
          tableNumber: "E3",
          title: "Household Balance Sheets – Distribution",
          url: E3_URL,
          lastModified: "2026-10-28T21:04:53.000Z",
          reason: E3_REASON,
        },
      ]);
    }),
  );

  it.effect("downloads the page and each spreadsheet once, and skips the PDF link", () =>
    Effect.gen(function* () {
      const { requests } = yield* rebuild(committedIndex(["E3"]), false);

      expect(requests.map(({ url }) => url).toSorted()).toEqual(
        [
          RBA_TABLES_PAGE,
          `${RBA_TABLES}d09hist.xls`,
          E3_URL,
          `${RBA_TABLES}f01d.xlsx`,
          `${RBA_TABLES}f01hist.xlsx`,
          F3_URL,
        ].toSorted(),
      );

      expect(requests.every(({ userAgent }) => userAgent?.startsWith("ausecon") === true)).toBe(
        true,
      );
    }),
  );
});

describe("rebuildSeriesIndex when the unreadable tables change", () => {
  it.effect("fails with UnreadableTablesChanged naming the added and removed tables", () =>
    Effect.gen(function* () {
      const error = yield* rebuild(committedIndex(["A5"]), false).pipe(Effect.flip);

      expect(error).toEqual(new UnreadableTablesChanged({ added: ["E3"], removed: ["A5"] }));
      expect(error.message).toContain("--accept-unreadable");
    }),
  );

  it.effect("passes with the accept flag and keeps the new unreadable tables", () =>
    Effect.gen(function* () {
      const { index } = yield* rebuild(committedIndex(["A5"]), true);

      expect(
        index.unreadableTables.map(({ tableNumber, reason }) => [tableNumber, reason]),
      ).toEqual([["E3", E3_REASON]]);
    }),
  );

  it.effect("passes when only the reason of an unreadable table changes", () =>
    Effect.gen(function* () {
      const { index } = yield* rebuild(committedIndex(["E3"]), false);

      expect(index.unreadableTables.map(({ reason }) => reason)).toEqual([E3_REASON]);
    }),
  );
});

describe("rebuildSeriesIndex when a download fails", () => {
  it.effect("fails with IndexBuildError when a table answers 404", () =>
    Effect.gen(function* () {
      const error = yield* rebuild(committedIndex(["E3"]), false, [
        [F3_URL, { status: 404, body: "Not found" }],
      ]).pipe(Effect.flip);

      expect(error._tag).toBe("IndexBuildError");
      expect(error).toMatchObject({ url: F3_URL, reason: expect.stringContaining("404") });
    }),
  );

  it.effect("fails with IndexBuildError when a table has no Last-Modified header", () =>
    Effect.gen(function* () {
      const error = yield* rebuild(committedIndex(["E3"]), false, [
        [F3_URL, { status: 200, body: syntheticTable([["Data", rbaDataSheet([F3_SERIES], [])]]) }],
      ]).pipe(Effect.flip);

      expect(error).toEqual(
        new IndexBuildError({
          url: F3_URL,
          reason: "The response has no valid Last-Modified header: ``.",
        }),
      );
    }),
  );
});

describe("renderSeriesIndex", () => {
  it("writes a module that exports the index as SERIES_INDEX", () => {
    const index = committedIndex(["E3"]);
    const source = renderSeriesIndex(index);

    expect(source).toMatch(/^\/\/ Generated by `bun run rba:index`/);
    expect(source).toContain('import type { SeriesIndex } from "./series-index";');

    const literal = source.slice(
      source.indexOf("SERIES_INDEX: SeriesIndex = ") + 28,
      source.lastIndexOf(";"),
    );

    expect(JSON.parse(literal)).toEqual(index);
  });
});
