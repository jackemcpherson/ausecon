import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { AbsRequest, readAbs } from "../src/index";
import {
  type RecordedResponse,
  directoryUrl,
  fixtureHttpClient,
  recorded,
  wagePriceIndexResponses,
} from "./fixture-http-client";
import { absDataSheet, syntheticTable } from "./synthetic-table";

const LABOUR_FORCE_RELEASE =
  "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release/";

// Each table holds one series, so a test can tell which tables were read.
const oneSeriesTable = (): RecordedResponse => ({
  status: 200,
  body: syntheticTable([
    [
      "Data1",
      absDataSheet(
        [
          {
            description: "Synthetic series ;",
            unit: "Number",
            seriesType: "Original",
            dataType: "FLOW",
            frequency: "Month",
            collectionMonth: 1,
            seriesId: "A1000001A",
          },
        ],
        [[46023, 1]],
      ),
    ],
  ]),
});

/**
 * Read table numbers of a catalogue number whose directory is one recorded
 * page, serving a one-series table at every table URL.
 */
const readTableNumbers = (
  catalogueNumber: string,
  directoryFile: string,
  tableUrls: ReadonlyArray<string>,
  tableNumbers: ReadonlyArray<string>,
) => {
  const http = fixtureHttpClient(
    new Map([
      [directoryUrl({ catno: catalogueNumber }), recorded(directoryFile)],
      ...tableUrls.map((url): [string, RecordedResponse] => [url, oneSeriesTable()]),
    ]),
  );

  return readAbs(AbsRequest.Catalogue({ catalogueNumber, tableNumbers })).pipe(
    Effect.provide(http.layer),
    Effect.map((observations) => ({
      tableIds: [...new Set(observations.map((observation) => observation.tableId))],
      requests: http.requests.map((request) => request.url),
    })),
  );
};

const LABOUR_FORCE_TABLES = ["62020001", "62020x28", "62020021_mth"].map(
  (tableId) => `${LABOUR_FORCE_RELEASE}${tableId}.xlsx`,
);

const readLabourForce = (tableNumbers: ReadonlyArray<string>) =>
  readTableNumbers("6202.0", "directory-6202.0.trimmed.xml", LABOUR_FORCE_TABLES, tableNumbers);

const TRADE_PRICES_RELEASE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/international-trade-price-indexes-australia/latest-release/";

const TRADE_PRICES_TABLES = [
  "645701",
  "6457010",
  "6457011",
  "645703",
  "645704",
  "645705",
  "645706",
  "645707",
  "645709",
].map((tableId) => `${TRADE_PRICES_RELEASE}${tableId}.xlsx`);

const readTradePrices = (tableNumbers: ReadonlyArray<string>) =>
  readTableNumbers("6457.0", "directory-6457.0.trimmed.xml", TRADE_PRICES_TABLES, tableNumbers);

const MODELLERS_DATABASE_TABLE =
  "https://www.abs.gov.au/statistics/economy/national-accounts/modellers-database/latest-release/1364015003.xlsx";

const readModellersDatabase = (tableNumbers: ReadonlyArray<string>) =>
  readTableNumbers(
    "1364.0.15.003",
    "directory-1364.0.15.003.trimmed.xml",
    [MODELLERS_DATABASE_TABLE],
    tableNumbers,
  );

const CPI_RELEASE =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release/";

const BUSINESS_COUNTS_RELEASE =
  "https://www.abs.gov.au/statistics/economy/business-indicators/counts-australian-businesses-including-entries-and-exits/latest-release/";

// The synthetic catalogue `5678.0` has titles with underscores that no
// recorded fixture covers.
const SYNTHETIC_RELEASE = "https://www.abs.gov.au/synthetic/latest-release/";

const SYNTHETIC_TABLES = ["567801", "567802", "567803", "567804", "567805", "567806"].map(
  (tableId) => `${SYNTHETIC_RELEASE}${tableId}.xlsx`,
);

const readSynthetic = (tableNumbers: ReadonlyArray<string>) =>
  readTableNumbers("5678.0", "synthetic-directory-5678.0.xml", SYNTHETIC_TABLES, tableNumbers);

describe("readAbs with table numbers", () => {
  it.effect("finds Table 001 for table number 1", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readLabourForce(["1"]);

      expect(tableIds).toEqual(["62020001"]);
    }),
  );

  it.effect("reads only the requested tables of a recorded release", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const observations = yield* readAbs(
        AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: ["1"] }),
      ).pipe(Effect.provide(http.layer));

      // Table 1 is 634501.xlsx; the unnumbered "All WPI Series" tables never match.
      expect(observations).toHaveLength(3087);
      expect(new Set(observations.map((observation) => observation.tableId))).toEqual(
        new Set(["634501"]),
      );
      expect(http.requests.filter((request) => request.url.endsWith(".xlsx"))).toHaveLength(1);
      expect(http.requests.some((request) => request.url.includes("ttitle"))).toBe(false);
    }),
  );

  it.effect("ignores case, so x28 finds Table X28", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readLabourForce(["x28"]);

      expect(tableIds).toEqual(["62020x28"]);
    }),
  );

  it.effect("keeps an underscore suffix that ends at a full stop", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readLabourForce(["21_mth"]);

      expect(tableIds).toEqual(["62020021_mth"]);
    }),
  );

  it.effect("matches each number of a title that lists several", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readTradePrices(["5", "12", "9", "16"]);

      // Tables 1, 3 and 12; Tables 4, 5 and 6; Tables 7 and 9; Table 16.
      expect(tableIds).toEqual(["645701", "645703", "645704", "645709"]);
    }),
  );

  it.effect("matches each number in a range and reads the table once", () =>
    Effect.gen(function* () {
      const { tableIds, requests } = yield* readModellersDatabase(["1", "9", "17"]);

      expect(tableIds).toEqual(["1364015003"]);
      expect(requests.filter((url) => url === MODELLERS_DATABASE_TABLE)).toHaveLength(1);
    }),
  );

  it.effect("matches no number outside a range", () =>
    Effect.gen(function* () {
      const error = yield* readModellersDatabase(["0", "18"]).pipe(Effect.flip);

      expect(error._tag).toBe("TableNotFound");
      expect(error).toMatchObject({ tableNumbers: ["0", "18"] });
    }),
  );

  it.effect("never matches APPENDIX 2 for table number 2", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readTableNumbers(
        "6401.0",
        "directory-6401.0.trimmed.xml",
        [`${CPI_RELEASE}640102.xlsx`],
        ["2"],
      );

      expect(tableIds).toEqual(["640102"]);
    }),
  );

  it.effect("reads a data cube number up to a colon", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readTableNumbers(
        "8165.0",
        "directory-8165.0-p1.xml",
        [`${BUSINESS_COUNTS_RELEASE}8165ts13.xlsx`],
        ["13"],
      );

      expect(tableIds).toEqual(["8165ts13"]);
    }),
  );

  it.effect("drops an underscore suffix that does not end at a full stop or colon", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readTableNumbers(
        "5678.0",
        "synthetic-directory-5678.0.xml",
        ["567801", "567802", "567803"].map((tableId) => `${SYNTHETIC_RELEASE}${tableId}.xlsx`),
        ["21", "14a_sep97", "7"],
      );

      // Table_21_Online_...; Table 14A_Sep97.; Table 7_A Monthly ...
      expect(tableIds).toEqual(["567801", "567802", "567803"]);
    }),
  );

  it.effect("matches each number of a list without and", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readSynthetic(["4", "5", "6"]);

      // Tables 4, 5, 6.
      expect(tableIds).toEqual(["567804"]);
    }),
  );

  it.effect("matches each number in a range of lettered tables with the same letter", () =>
    Effect.gen(function* () {
      const { tableIds } = yield* readSynthetic(["3a", "9A"]);

      // Tables 2a to 9a.
      expect(tableIds).toEqual(["567805"]);
    }),
  );

  it.effect("matches only the ends of a range whose letters differ", () =>
    Effect.gen(function* () {
      const ends = yield* readSynthetic(["2a", "4b"]);
      const error = yield* readSynthetic(["3a", "3b", "5a"]).pipe(Effect.flip);

      // Tables 2a to 9a; Tables 2a to 4b.
      expect(ends.tableIds).toEqual(["567805", "567806"]);
      expect(error._tag).toBe("TableNotFound");
      expect(error).toMatchObject({ tableNumbers: ["3B"] });
    }),
  );

  it.effect("fails once with TableNotFound listing every unmatched table number", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[directoryUrl({ catno: "6202.0" }), recorded("directory-6202.0.trimmed.xml")]]),
      );

      const error = yield* readAbs(
        AbsRequest.Catalogue({ catalogueNumber: "6202.0", tableNumbers: ["1", "2", "21", "x29"] }),
      ).pipe(Effect.provide(http.layer), Effect.flip);

      expect(error._tag).toBe("TableNotFound");
      expect(error).toMatchObject({ catalogueNumber: "6202.0", tableNumbers: ["2", "21", "X29"] });
      expect(http.requests.map((request) => request.url)).toEqual([
        directoryUrl({ catno: "6202.0" }),
      ]);
    }),
  );
});
