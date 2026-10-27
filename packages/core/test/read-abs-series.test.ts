import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { AbsRequest, SeriesId, SeriesNotFound, readAbs } from "../src/index";
import {
  WAGE_PRICE_INDEX_RELEASE,
  directoryUrl,
  fixtureHttpClient,
  recorded,
} from "./fixture-http-client";

const MODELLERS_DATABASE_RELEASE =
  "https://www.abs.gov.au/statistics/economy/national-accounts/modellers-database/latest-release/";

/** Recorded `sid` responses and the spreadsheets they point to. */
const seriesResponses = () =>
  new Map([
    [directoryUrl({ sid: "A2603039T" }), recorded("sid-A2603039T.xml")],
    [directoryUrl({ sid: "A2713846W" }), recorded("sid-A2713846W.xml")],
    [directoryUrl({ sid: "A2454446F" }), recorded("sid-A2454446F.xml")],
    [directoryUrl({ sid: "A2325807L" }), recorded("sid-A2325807L.xml")],
    [directoryUrl({ sid: "Z9999999Z" }), recorded("sid-A2325807L.xml")],
    [`${WAGE_PRICE_INDEX_RELEASE}634501.xlsx`, recorded("634501.xlsx")],
    [`${MODELLERS_DATABASE_RELEASE}1364015003.xlsx`, recorded("1364015003.xlsx")],
  ]);

const countBySeries = (observations: ReadonlyArray<{ readonly seriesId: string }>) =>
  Object.fromEntries(
    [...Map.groupBy(observations, (observation) => observation.seriesId)].map(
      ([seriesId, group]) => [seriesId, group.length],
    ),
  );

describe("readAbs for series IDs", () => {
  it.effect("returns only the requested series from two catalogue numbers", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const observations = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2603039T", "A2454446F"] }),
      ).pipe(Effect.provide(http.layer));

      // `NoObs` in the recorded Time Series Directory rows.
      expect(countBySeries(observations)).toEqual({ A2603039T: 116, A2454446F: 268 });
      expect(new Set(observations.map((observation) => observation.tableId))).toEqual(
        new Set(["634501", "1364015003"]),
      );
    }),
  );

  it.effect("reads a series listed in several tables from its first table only", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const observations = yield* readAbs(AbsRequest.Series({ seriesIds: ["A2603039T"] })).pipe(
        Effect.provide(http.layer),
      );

      // The recorded `sid` response lists 634501, 634503b, 634505b, and
      // 63450table2bto9b; 634501 has the lowest `TableOrder`.
      expect(countBySeries(observations)).toEqual({ A2603039T: 116 });
      expect(new Set(observations.map((observation) => observation.tableId))).toEqual(
        new Set(["634501"]),
      );
    }),
  );

  it.effect("downloads a spreadsheet once for two series from one table", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const observations = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2603039T", "A2713846W"] }),
      ).pipe(Effect.provide(http.layer));

      expect(countBySeries(observations)).toEqual({ A2603039T: 116, A2713846W: 116 });
      expect(http.requests.map((request) => request.url).toSorted()).toEqual([
        directoryUrl({ sid: "A2603039T" }),
        directoryUrl({ sid: "A2713846W" }),
        `${WAGE_PRICE_INDEX_RELEASE}634501.xlsx`,
      ]);
    }),
  );

  it.effect("upper-cases lower-case series IDs", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const observations = yield* readAbs(AbsRequest.Series({ seriesIds: ["a2454446f"] })).pipe(
        Effect.provide(http.layer),
      );

      expect(countBySeries(observations)).toEqual({ A2454446F: 268 });
    }),
  );

  it.effect("fails once with SeriesNotFound naming every unknown series ID", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const error = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2325807L", "A2603039T", "Z9999999Z"] }),
      ).pipe(Effect.flip, Effect.provide(http.layer));

      expect(error).toEqual(
        new SeriesNotFound({
          seriesIds: ["A2325807L", "Z9999999Z"].map((seriesId) =>
            Schema.decodeSync(SeriesId)(seriesId),
          ),
        }),
      );
      expect(http.requests.some((request) => request.url.endsWith(".xlsx"))).toBe(false);
    }),
  );
});
