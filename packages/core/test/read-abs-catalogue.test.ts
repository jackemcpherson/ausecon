import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { AbsRequest, readAbs } from "../src/index";
import {
  WAGE_PRICE_INDEX_RELEASE,
  WAGE_PRICE_INDEX_TABLE_IDS,
  fixtureHttpClient,
  wagePriceIndexResponses,
} from "./fixture-http-client";

const TABLE_1_TITLE =
  "Table 1. Total Hourly Rates of Pay Excluding Bonuses: Sector, Original, Seasonally Adjusted and Trend";

const PRIVATE_SECTOR_DESCRIPTION =
  "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  Australia ;  Private ;  All industries ;";

describe("readAbs for every table of a catalogue number", () => {
  it.effect("returns each observation with the metadata of its spreadsheet", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const observations = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345" })).pipe(
        Effect.provide(http.layer),
      );

      // Checked by hand against cells A11, B1 to B11 of 634501.xlsx sheet Data1.
      expect(
        observations.find(
          (observation) =>
            observation.tableId === "634501" &&
            observation.seriesId === "A2603039T" &&
            observation.date === "1997-09-01",
        ),
      ).toEqual({
        tableId: "634501",
        sheet: "Data1",
        tableTitle: TABLE_1_TITLE,
        date: "1997-09-01",
        seriesDescription: PRIVATE_SECTOR_DESCRIPTION,
        value: 67.4,
        seriesType: "Original",
        dataType: "INDEX",
        collectionMonth: "3",
        frequency: "Quarter",
        seriesId: "A2603039T",
        unit: "Index Numbers",
      });
    }),
  );

  it.effect("returns only series ID, date, and value with metadata off", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const observations = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" }), {
        metadata: false,
      }).pipe(Effect.provide(http.layer));

      expect(observations).toHaveLength(73_357);
      expect(observations[0]).toEqual({ seriesId: "A2603039T", date: "1997-09-01", value: 67.4 });
    }),
  );

  it.effect("reads every table of the latest release and drops blank cells", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const observations = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      // Numeric cells with a date in column A, counted with SheetJS outside the library.
      expect(observations.length).toBe(73_357);
      expect(new Set(observations.map((observation) => observation.tableId))).toEqual(
        new Set(WAGE_PRICE_INDEX_TABLE_IDS),
      );
      expect(observations.filter((observation) => observation.tableId === "634501")).toHaveLength(
        3087,
      );
    }),
  );

  it.effect("requests every spreadsheet and directory page once, with the User-Agent", () =>
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

      const observations = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
        Effect.provide(http.layer),
      );

      const privateSector = observations.filter(
        (observation) =>
          observation.tableId === "634501" &&
          observation.seriesDescription === PRIVATE_SECTOR_DESCRIPTION &&
          observation.date === "1997-09-01",
      );

      expect(
        privateSector.map((observation) => [observation.seriesId, observation.seriesType]),
      ).toEqual(
        expect.arrayContaining([
          ["A2603039T", "Original"],
          ["A2713846W", "Seasonally Adjusted"],
        ]),
      );
    }),
  );
});
