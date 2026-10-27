import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import {
  type RecordedResponse,
  directoryUrl,
  fixtureHttpClient,
  recorded,
  type SyntheticSeries,
  absDataSheet,
  syntheticTable,
} from "@ausecon/testkit";

import { AbsRequest, readAbs } from "../src/index";

// The synthetic catalogue `1234.0` has one table with a superseded and a
// current release, one table whose URL has a space, and one row with no URL.
const SYNTHETIC_RELEASE = "https://www.abs.gov.au/synthetic/latest-release/";
const TABLE_1_URL = `${SYNTHETIC_RELEASE}123401.xlsx`;
const TABLE_2_URL = `${SYNTHETIC_RELEASE}table+2.xlsx`;

const INDEX_SERIES: SyntheticSeries = {
  description: "Synthetic index ;  Australia ;",
  unit: "Index Numbers",
  seriesType: "Original",
  dataType: "INDEX",
  frequency: "Quarter",
  collectionMonth: 3,
  seriesId: "A1000001A",
};

const COUNT_SERIES: SyntheticSeries = {
  description: "Synthetic count ;  Australia ;",
  unit: "Number",
  seriesType: "Original",
  dataType: "FLOW",
  frequency: "Month",
  collectionMonth: 1,
  seriesId: "A1000002B",
};

const table2 = syntheticTable([["Data1", absDataSheet([COUNT_SERIES], [[46023, 7]])]]);

const syntheticResponses = (
  table1: Uint8Array<ArrayBuffer>,
): ReadonlyMap<string, RecordedResponse> =>
  new Map([
    [directoryUrl({ catno: "1234.0" }), recorded("synthetic-directory-1234.0.xml")],
    [TABLE_1_URL, { status: 200, body: table1 }],
    [TABLE_2_URL, { status: 200, body: table2 }],
  ]);

const readSynthetic = (table1: Uint8Array<ArrayBuffer>) => {
  const http = fixtureHttpClient(syntheticResponses(table1));

  return readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
    Effect.provide(http.layer),
    Effect.map((series) => ({ series, requests: http.requests })),
  );
};

const validTable1 = syntheticTable([
  ["Index", [["Time Series Workbook"], ["Contents"]]],
  [
    "Data1",
    absDataSheet(
      [INDEX_SERIES],
      [
        [45992, 99.5],
        [46023, 100],
      ],
    ),
  ],
]);

describe("readAbs on a synthetic release", () => {
  it.effect("titles each table from its latest release", () =>
    Effect.gen(function* () {
      const { series } = yield* readSynthetic(validTable1);

      expect(
        series.filter(({ table }) => table.tableId === "123401").map(({ table }) => table),
      ).toEqual([{ tableId: "123401", tableTitle: "Table 1. Current title & notes" }]);
    }),
  );

  it.effect("replaces spaces in a table URL and skips rows without a table URL", () =>
    Effect.gen(function* () {
      const { series, requests } = yield* readSynthetic(validTable1);

      expect(requests.map((request) => request.url)).toEqual(
        expect.arrayContaining([TABLE_1_URL, TABLE_2_URL]),
      );
      expect(requests).toHaveLength(3);
      expect(series.filter(({ seriesId }) => seriesId === "A1000002B")).toEqual([
        {
          seriesId: "A1000002B",
          seriesDescription: "Synthetic count ;  Australia ;",
          unit: "Number",
          seriesType: "Original",
          dataType: "FLOW",
          frequency: "Month",
          collectionMonth: "1",
          table: { tableId: "table 2", tableTitle: "Table 2. Spreadsheet name with a space" },
          sheet: "Data1",
          observations: [{ date: "2026-01-01", value: 7 }],
        },
      ]);
    }),
  );

  it.effect("drops notes, blank cells, and text cells, and skips non-data sheets", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Index", [["Series ID"]]],
        [
          "Data1",
          absDataSheet(
            [
              INDEX_SERIES,
              { ...INDEX_SERIES, seriesId: "A1000004D" },
              { ...INDEX_SERIES, description: "", seriesId: "" },
            ],
            [
              [45992, 99.5, null, 1],
              ["Trend Break", 1, 1, 1],
              ["see Explanatory Notes", 2, 2, 1],
              [null, 3, 3, 1],
              [46023, null, 101.25, 1],
              [46054, "np", 102, 1],
              [46082.75, 103, 103, 1],
            ],
          ),
        ],
        ["Data2", absDataSheet([{ ...INDEX_SERIES, seriesId: "A1000005E" }], [[46082, 50]])],
        ["Notes", [["Not data"]]],
        ["Table 1 contents", [["Not data"]]],
        ["Enquiries", [["Not data"]]],
      ]);

      const { series } = yield* readSynthetic(table1);

      expect(
        series
          .filter(({ table }) => table.tableId === "123401")
          .map(({ sheet, seriesId, observations }) => [sheet, seriesId, observations]),
      ).toEqual([
        [
          "Data1",
          "A1000001A",
          [
            { date: "2025-12-01", value: 99.5 },
            { date: "2026-03-01", value: 103 },
          ],
        ],
        [
          "Data1",
          "A1000004D",
          [
            { date: "2026-01-01", value: 101.25 },
            { date: "2026-02-01", value: 102 },
            { date: "2026-03-01", value: 103 },
          ],
        ],
        ["Data2", "A1000005E", [{ date: "2026-03-01", value: 50 }]],
      ]);
    }),
  );

  it.effect("skips sheets named with Table and a space, matching case", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Table 1", [["Not data"]]],
        ["Data table 1", absDataSheet([INDEX_SERIES], [[46023, 100]])],
      ]);

      const { series } = yield* readSynthetic(table1);

      expect(
        series.filter(({ table }) => table.tableId === "123401").map(({ sheet }) => sheet),
      ).toEqual(["Data table 1"]);
    }),
  );

  it.effect("keeps a Series whose cells are all blank, with no observations", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        [
          "Data1",
          absDataSheet(
            [INDEX_SERIES, { ...INDEX_SERIES, seriesId: "A1000006F" }],
            [[46023, 100, null]],
          ),
        ],
      ]);

      const { series } = yield* readSynthetic(table1);

      expect(
        series
          .filter(({ table }) => table.tableId === "123401")
          .map(({ seriesId, observations }) => [seriesId, observations.length]),
      ).toEqual([
        ["A1000001A", 1],
        ["A1000006F", 0],
      ]);
    }),
  );

  it.effect("fails with TableLayoutError when row 10 holds text that is not a series ID", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        [
          "Data1",
          absDataSheet([INDEX_SERIES, { ...INDEX_SERIES, seriesId: "Total" }], [[46023, 100, 200]]),
        ],
      ]);

      const error = yield* readSynthetic(table1).pipe(Effect.flip);

      expect(error._tag).toBe("TableLayoutError");
      expect(error).toMatchObject({ tableId: "123401", sheet: "Data1" });
      expect(error).toHaveProperty("reason", expect.stringContaining("C10"));
    }),
  );

  it.effect("fails with TableLayoutError when column A holds text that is not a note", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Data1", absDataSheet([INDEX_SERIES], [[46023, 100]])],
        [
          "Data2",
          absDataSheet(
            [INDEX_SERIES],
            [
              [46023, 100],
              ["Total", 200],
            ],
          ),
        ],
      ]);

      const error = yield* readSynthetic(table1).pipe(Effect.flip);

      expect(error._tag).toBe("TableLayoutError");
      expect(error).toMatchObject({ tableId: "123401", sheet: "Data2" });
      expect(error).toHaveProperty("reason", expect.stringContaining("A12"));
    }),
  );

  it.effect("fails with TableLayoutError when row 10 does not hold Series ID", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Data1", absDataSheet([INDEX_SERIES], [[46023, 100]]).slice(1)],
      ]);

      const error = yield* readSynthetic(table1).pipe(Effect.flip);

      expect(error._tag).toBe("TableLayoutError");
      expect(error).toMatchObject({
        tableId: "123401",
        sheet: "Data1",
      });
    }),
  );

  it.effect("fails with TableLayoutError when a metadata row is missing", () =>
    Effect.gen(function* () {
      const rows = absDataSheet([INDEX_SERIES], [[46023, 100]]).map((row) =>
        row[0] === "Collection Month" ? ["Collection month", ...row.slice(1)] : row,
      );

      const error = yield* readSynthetic(
        syntheticTable([
          ["Data1", absDataSheet([INDEX_SERIES], [[46023, 100]])],
          ["Data2", rows],
        ]),
      ).pipe(Effect.flip);

      expect(error._tag).toBe("TableLayoutError");
      expect(error).toMatchObject({ tableId: "123401", sheet: "Data2" });
      expect(error).toHaveProperty("reason", expect.stringContaining("collectionMonth"));
    }),
  );

  it.effect("fails with TableLayoutError when the table cannot be opened", () =>
    Effect.gen(function* () {
      const error = yield* readSynthetic(
        new TextEncoder().encode("<html><body>Not found</body></html>"),
      ).pipe(Effect.flip);

      expect(error._tag).toBe("TableLayoutError");
      expect(error).toHaveProperty("tableId", "123401");
      expect(error).not.toHaveProperty("sheet");
    }),
  );
  it.effect("keeps the title of each table when two tables share a file name", () =>
    Effect.gen(function* () {
      const firstUrl = "https://www.abs.gov.au/synthetic/first/latest-release/data.xlsx";
      const secondUrl = "https://www.abs.gov.au/synthetic/second/latest-release/data.xlsx";

      const row = (tableUrl: string, title: string, tableOrder: number, seriesId: string) =>
        `<Series><ProductReleaseDate>15/04/2026</ProductReleaseDate><TableURL>${tableUrl}</TableURL><TableTitle>${title}</TableTitle><TableOrder>${tableOrder}</TableOrder><SeriesID>${seriesId}</SeriesID></Series>`;

      const table = (series: SyntheticSeries): RecordedResponse => ({
        status: 200,
        body: syntheticTable([["Data1", absDataSheet([series], [[46023, 1]])]]),
      });

      const http = fixtureHttpClient(
        new Map<string, RecordedResponse>([
          [
            directoryUrl({ catno: "1234.0" }),
            {
              status: 200,
              body: `<?xml version="1.0" encoding="utf-8" ?><TimeSeriesIndex>${row(firstUrl, "Table 1. First", 1, "A1000001A")}${row(secondUrl, "Table 2. Second", 2, "A1000002B")}</TimeSeriesIndex>`,
            },
          ],
          [firstUrl, table(INDEX_SERIES)],
          [secondUrl, table(COUNT_SERIES)],
        ]),
      );

      const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
        Effect.provide(http.layer),
      );

      expect(series.map(({ seriesId, table }) => [seriesId, table])).toEqual([
        ["A1000001A", { tableId: "data", tableTitle: "Table 1. First" }],
        ["A1000002B", { tableId: "data", tableTitle: "Table 2. Second" }],
      ]);
    }),
  );
});

describe("readAbs edge responses", () => {
  it.effect(
    "fails with TimeSeriesDirectoryError for a listed table URL that cannot be requested",
    () =>
      Effect.gen(function* () {
        const http = fixtureHttpClient(
          new Map<string, RecordedResponse>([
            [
              directoryUrl({ catno: "1234.0" }),
              {
                status: 200,
                body: `<?xml version="1.0" encoding="utf-8" ?><TimeSeriesIndex><Series><ProductReleaseDate>15/04/2026</ProductReleaseDate><TableURL>http://[not a host]/data.xlsx</TableURL><TableTitle>Table 1. Bad</TableTitle><TableOrder>1</TableOrder><SeriesID>A1000001A</SeriesID></Series></TimeSeriesIndex>`,
              },
            ],
          ]),
        );

        const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
          Effect.flip,
          Effect.provide(http.layer),
        );

        expect(error._tag).toBe("TimeSeriesDirectoryError");
        expect(error).toHaveProperty("url", "http://[not+a+host]/data.xlsx");
        expect(error).toHaveProperty(
          "reason",
          expect.stringMatching(
            /^The Time Series Directory lists a URL that cannot be requested: \S/,
          ),
        );
        expect(http.requests).toHaveLength(1);
      }),
  );

  it.effect("fails with CatalogueNotFound when no row links to a table", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([
          [
            directoryUrl({ catno: "6204.0.55.001" }),
            recorded("directory-6204.0.55.001-p1.trimmed.xml"),
          ],
        ]),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6204.0.55.001" })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error._tag).toBe("CatalogueNotFound");
      expect(error).toHaveProperty("catalogueNumber", "6204.0.55.001");
    }),
  );

  it.effect("reads one directory page without NumPages and fails on an HTTP 404", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([
          [directoryUrl({ catno: "8165.0" }), recorded("directory-8165.0-p1.xml")],
          [
            "https://www.abs.gov.au/statistics/economy/business-indicators/counts-australian-businesses-including-entries-and-exits/latest-release/8165ts13.xlsx",
            { status: 404, body: "<html><body>Page not found</body></html>" },
          ],
        ]),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "8165.0" })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error._tag).toBe("AbsUnavailable");
      expect(error).toHaveProperty(
        "url",
        "https://www.abs.gov.au/statistics/economy/business-indicators/counts-australian-businesses-including-entries-and-exits/latest-release/8165ts13.xlsx",
      );
      expect(error).toHaveProperty("status", 404);
      expect(error).toHaveProperty("detail", "The ABS answered with status 404.");
      expect(http.requests).toHaveLength(2);
    }),
  );

  it.effect("follows a redirect that the HttpClient returns", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map<string, RecordedResponse>([
          [
            directoryUrl({ catno: "9999.0" }),
            {
              status: 301,
              body: "",
              headers: {
                location: "https://www.abs.gov.au/servlet/TSSearchServlet?catno=9999.0",
              },
            },
          ],
          [
            "https://www.abs.gov.au/servlet/TSSearchServlet?catno=9999.0",
            recorded("directory-catno-9999.0.xml"),
          ],
        ]),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "9999.0" })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error._tag).toBe("CatalogueNotFound");
      expect(http.requests.map((request) => request.userAgent)).toEqual([
        expect.stringContaining("ausecon"),
        expect.stringContaining("ausecon"),
      ]);
    }),
  );

  it.effect("fails with AbsUnavailable without a status when a request gets no response", () =>
    Effect.gen(function* () {
      const offline = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({ request, description: "offline" }),
            }),
          ),
        ),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
        Effect.flip,
        Effect.provide(offline),
      );

      expect(error._tag).toBe("AbsUnavailable");
      expect(error).toHaveProperty("url", directoryUrl({ catno: "1234.0" }));
      expect(error).toHaveProperty("detail", "offline");
      expect(error).not.toHaveProperty("status");
    }),
  );

  it.effect("keeps the fetch error message as the detail when a request gets no response", () =>
    Effect.gen(function* () {
      const offline = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new TypeError("getaddrinfo ENOTFOUND abs.gov.au"),
              }),
            }),
          ),
        ),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
        Effect.flip,
        Effect.provide(offline),
      );

      expect(error._tag).toBe("AbsUnavailable");
      expect(error).toHaveProperty("detail", "getaddrinfo ENOTFOUND abs.gov.au");
    }),
  );

  it.effect("adds the nested cause to the fetch error message", () =>
    Effect.gen(function* () {
      const offline = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new TypeError("fetch failed", {
                  cause: new Error("getaddrinfo ENOTFOUND abs.gov.au"),
                }),
              }),
            }),
          ),
        ),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "1234.0" })).pipe(
        Effect.flip,
        Effect.provide(offline),
      );

      expect(error._tag).toBe("AbsUnavailable");
      expect(error).toHaveProperty("detail", "fetch failed: getaddrinfo ENOTFOUND abs.gov.au");
    }),
  );
});
