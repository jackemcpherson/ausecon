import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  WAGE_PRICE_INDEX_RELEASE,
  WAGE_PRICE_INDEX_TABLE_IDS,
  fixtureHttpClient,
  wagePriceIndexResponses,
} from "@ausecon/testkit";

import { AbsRequest, type Series, readAbs } from "../src/index";

const TABLE_1_TITLE =
  "Table 1. Total Hourly Rates of Pay Excluding Bonuses: Sector, Original, Seasonally Adjusted and Trend";

const PRIVATE_SECTOR_DESCRIPTION =
  "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  Australia ;  Private ;  All industries ;";

/** Every observation of the Series, across all of them. */
const observationCount = (series: ReadonlyArray<Series>): number =>
  series.reduce((total, { observations }) => total + observations.length, 0);

describe("readAbs for every table of a catalogue number", () => {
  it.effect("returns each Series with its metadata, Table, sheet, and observations", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345" })).pipe(
        Effect.provide(http.layer),
      );

      const privateSector = series.find(
        ({ table, seriesId }) => table.tableId === "634501" && seriesId === "A2603039T",
      );

      // Checked by hand against cells A11 to A13, B1 to B13 of 634501.xlsx sheet Data1.
      expect(privateSector).toMatchObject({
        publisher: "ABS",
        seriesId: "A2603039T",
        description: PRIVATE_SECTOR_DESCRIPTION,
        unit: "Index Numbers",
        seriesType: "Original",
        dataType: "INDEX",
        frequency: "Quarter",
        collectionMonth: "3",
        table: { tableId: "634501", tableTitle: TABLE_1_TITLE },
        sheet: "Data1",
      });
      expect(Object.keys(privateSector ?? {})).toEqual([
        "publisher",
        "seriesId",
        "description",
        "unit",
        "seriesType",
        "dataType",
        "frequency",
        "collectionMonth",
        "table",
        "sheet",
        "observations",
      ]);
      expect(privateSector?.observations[0]).toEqual({ date: "1997-09-01", value: 67.4 });
      // `NoObs` in the recorded Time Series Directory rows.
      expect(privateSector?.observations).toHaveLength(116);
    }),
  );

  it.effect("returns one Series per series ID and sheet, in table, sheet, and column order", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      // Series ID cells in row 10 of each data sheet, read with SheetJS outside the library.
      expect(series).toHaveLength(929);
      expect(series.filter(({ table }) => table.tableId === "634501")).toHaveLength(27);
      expect(
        series.slice(0, 2).map(({ table, sheet, seriesId }) => [table.tableId, sheet, seriesId]),
      ).toEqual([
        ["634501", "Data1", "A2603039T"],
        ["634501", "Data1", "A2603989W"],
      ]);
    }),
  );

  it.effect("reads every table of the latest release and drops blank cells", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      // Numeric cells with a date in column A, counted with SheetJS outside the library.
      expect(observationCount(series)).toBe(73_357);
      expect(new Set(series.map(({ table }) => table.tableId))).toEqual(
        new Set(WAGE_PRICE_INDEX_TABLE_IDS),
      );
      expect(observationCount(series.filter(({ table }) => table.tableId === "634501"))).toBe(3087);
    }),
  );

  it.effect("requests every table and directory page once, with the User-Agent", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      const urls = http.requests.map((request) => request.url);

      expect(urls.toSorted()).toEqual([...wagePriceIndexResponses().keys()].toSorted());
      expect(urls.filter((url) => url.startsWith(WAGE_PRICE_INDEX_RELEASE))).toHaveLength(17);
      expect(new Set(http.requests.map((request) => request.userAgent)).size).toBe(1);
      expect(http.requests[0]?.userAgent).toContain("ausecon");
    }),
  );

  it.effect("keeps series with the same description apart by series ID", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const series = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      const privateSector = series.filter(
        ({ table, description }) =>
          table.tableId === "634501" && description === PRIVATE_SECTOR_DESCRIPTION,
      );

      expect(privateSector.map(({ seriesId, seriesType }) => [seriesId, seriesType])).toEqual(
        expect.arrayContaining([
          ["A2603039T", "Original"],
          ["A2713846W", "Seasonally Adjusted"],
        ]),
      );
    }),
  );
});
