import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { AbsRequest, readAbs } from "../src/index";
import {
  type RecordedResponse,
  directoryUrl,
  fixtureHttpClient,
  recorded,
} from "./fixture-http-client";
import { type SyntheticSeries, absDataSheet, syntheticTable } from "./synthetic-table";

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
    Effect.map((observations) => ({ observations, requests: http.requests })),
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
      const { observations } = yield* readSynthetic(validTable1);

      expect(
        new Set(
          observations
            .filter((observation) => observation.tableId === "123401")
            .map((observation) => observation.tableTitle),
        ),
      ).toEqual(new Set(["Table 1. Current title & notes"]));
    }),
  );

  it.effect("replaces spaces in a table URL and skips rows without a table URL", () =>
    Effect.gen(function* () {
      const { observations, requests } = yield* readSynthetic(validTable1);

      expect(requests.map((request) => request.url)).toEqual(
        expect.arrayContaining([TABLE_1_URL, TABLE_2_URL]),
      );
      expect(requests).toHaveLength(3);
      expect(observations.filter((observation) => observation.seriesId === "A1000002B")).toEqual([
        {
          tableId: "table 2",
          sheet: "Data1",
          tableTitle: "Table 2. Spreadsheet name with a space",
          date: "2026-01-01",
          seriesDescription: "Synthetic count ;  Australia ;",
          value: 7,
          seriesType: "Original",
          dataType: "FLOW",
          collectionMonth: "1",
          frequency: "Month",
          seriesId: "A1000002B",
          unit: "Number",
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

      const { observations } = yield* readSynthetic(table1);

      expect(
        observations
          .filter((observation) => observation.tableId === "123401")
          .map((observation) => [
            observation.sheet,
            observation.seriesId,
            observation.date,
            observation.value,
          ]),
      ).toEqual([
        ["Data1", "A1000001A", "2025-12-01", 99.5],
        ["Data1", "A1000001A", "2026-03-01", 103],
        ["Data1", "A1000004D", "2026-01-01", 101.25],
        ["Data1", "A1000004D", "2026-02-01", 102],
        ["Data1", "A1000004D", "2026-03-01", 103],
        ["Data2", "A1000005E", "2026-03-01", 50],
      ]);
    }),
  );

  it.effect("skips sheets named with Table and a space, matching case", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Table 1", [["Not data"]]],
        ["Data table 1", absDataSheet([INDEX_SERIES], [[46023, 100]])],
      ]);

      const { observations } = yield* readSynthetic(table1);

      expect(
        observations
          .filter((observation) => observation.tableId === "123401")
          .map((observation) => observation.sheet),
      ).toEqual(["Data table 1"]);
    }),
  );

  it.effect("fails with WorkbookLayoutError when column A holds text that is not a note", () =>
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

      expect(error._tag).toBe("WorkbookLayoutError");
      expect(error).toMatchObject({ tableId: "123401", sheet: "Data2" });
      expect(error).toHaveProperty("reason", expect.stringContaining("A12"));
    }),
  );

  it.effect("fails with WorkbookLayoutError when row 10 does not hold Series ID", () =>
    Effect.gen(function* () {
      const table1 = syntheticTable([
        ["Data1", absDataSheet([INDEX_SERIES], [[46023, 100]]).slice(1)],
      ]);

      const error = yield* readSynthetic(table1).pipe(Effect.flip);

      expect(error._tag).toBe("WorkbookLayoutError");
      expect(error).toMatchObject({
        tableId: "123401",
        sheet: "Data1",
      });
    }),
  );

  it.effect("fails with WorkbookLayoutError when a metadata row is missing", () =>
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

      expect(error._tag).toBe("WorkbookLayoutError");
      expect(error).toMatchObject({ tableId: "123401", sheet: "Data2" });
      expect(error).toHaveProperty("reason", expect.stringContaining("collectionMonth"));
    }),
  );

  it.effect("fails with WorkbookLayoutError when the table cannot be opened", () =>
    Effect.gen(function* () {
      const error = yield* readSynthetic(
        new TextEncoder().encode("<html><body>Not found</body></html>"),
      ).pipe(Effect.flip);

      expect(error._tag).toBe("WorkbookLayoutError");
      expect(error).toHaveProperty("tableId", "123401");
      expect(error).not.toHaveProperty("sheet");
    }),
  );
});

describe("readAbs edge responses", () => {
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

      expect(error._tag).toBe("HttpClientError");
      expect(error).toHaveProperty("reason._tag", "StatusCodeError");
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
});
