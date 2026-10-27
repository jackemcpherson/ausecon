import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { AbsRequest, type Series, SeriesNotFound, readAbs } from "../src/index";
import {
  type RecordedResponse,
  WAGE_PRICE_INDEX_RELEASE,
  directoryUrl,
  fixtureHttpClient,
  recorded,
} from "./fixture-http-client";
import { type SyntheticSeries, absDataSheet, syntheticTable } from "./synthetic-table";

const MODELLERS_DATABASE_RELEASE =
  "https://www.abs.gov.au/statistics/economy/national-accounts/modellers-database/latest-release/";

/** Recorded `sid` responses and the tables they point to. */
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

/** A synthetic series with the given series ID. */
const syntheticSeries = (seriesId: string): SyntheticSeries => ({
  description: `Synthetic series ${seriesId} ;`,
  unit: "Number",
  seriesType: "Original",
  dataType: "FLOW",
  frequency: "Month",
  collectionMonth: 1,
  seriesId,
});

/** A `sid` response with one row that links to a table. */
const sidResponse = (seriesId: string, tableUrl: string): RecordedResponse => ({
  status: 200,
  body: `<?xml version="1.0" encoding="utf-8" ?><TimeSeriesIndex><Series><ProductReleaseDate>15/04/2026</ProductReleaseDate><TableURL>${tableUrl}</TableURL><TableTitle>Table 1. Synthetic</TableTitle><TableOrder>1</TableOrder><SeriesID>${seriesId}</SeriesID></Series></TimeSeriesIndex>`,
});

/** The observation count of each Series, by series ID. */
const countBySeries = (series: ReadonlyArray<Series>) =>
  Object.fromEntries(series.map(({ seriesId, observations }) => [seriesId, observations.length]));

/** The distinct table IDs of the Series. */
const tableIdsOf = (series: ReadonlyArray<Series>) =>
  new Set(series.map(({ table }) => table.tableId));

describe("readAbs for series IDs", () => {
  it.effect("returns only the requested series from two catalogue numbers", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const series = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2603039T", "A2454446F"] }),
      ).pipe(Effect.provide(http.layer));

      // `NoObs` in the recorded Time Series Directory rows.
      expect(countBySeries(series)).toEqual({ A2603039T: 116, A2454446F: 268 });
      expect(series).toHaveLength(2);
      expect(tableIdsOf(series)).toEqual(new Set(["634501", "1364015003"]));
    }),
  );

  it.effect("reads a series listed in several tables from its first table only", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const series = yield* readAbs(AbsRequest.Series({ seriesIds: ["A2603039T"] })).pipe(
        Effect.provide(http.layer),
      );

      // The recorded `sid` response lists 634501, 634503b, 634505b, and
      // 63450table2bto9b; 634501 has the lowest `TableOrder`.
      expect(countBySeries(series)).toEqual({ A2603039T: 116 });
      expect(series).toHaveLength(1);
      expect(tableIdsOf(series)).toEqual(new Set(["634501"]));
    }),
  );

  it.effect("downloads a table once for two series from one table", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const series = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2603039T", "A2713846W"] }),
      ).pipe(Effect.provide(http.layer));

      expect(countBySeries(series)).toEqual({ A2603039T: 116, A2713846W: 116 });
      expect(http.requests.map((request) => request.url).toSorted()).toEqual([
        directoryUrl({ sid: "A2603039T" }),
        directoryUrl({ sid: "A2713846W" }),
        `${WAGE_PRICE_INDEX_RELEASE}634501.xlsx`,
      ]);
    }),
  );

  it.effect("reads each series only from its own table when two tables share a file name", () =>
    Effect.gen(function* () {
      const firstUrl = "https://www.abs.gov.au/synthetic/first/latest-release/data.xlsx";
      const secondUrl = "https://www.abs.gov.au/synthetic/second/latest-release/data.xlsx";

      // Both tables hold both series, with a different value in each table.
      const table = (value: number): RecordedResponse => ({
        status: 200,
        body: syntheticTable([
          [
            "Data1",
            absDataSheet(
              [syntheticSeries("A1000001A"), syntheticSeries("A1000002B")],
              [[46023, value, value]],
            ),
          ],
        ]),
      });

      const http = fixtureHttpClient(
        new Map([
          [directoryUrl({ sid: "A1000001A" }), sidResponse("A1000001A", firstUrl)],
          [directoryUrl({ sid: "A1000002B" }), sidResponse("A1000002B", secondUrl)],
          [firstUrl, table(1)],
          [secondUrl, table(2)],
        ]),
      );

      const series = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A1000001A", "A1000002B"] }),
      ).pipe(Effect.provide(http.layer));

      expect(
        series.map(({ seriesId, observations }) => [seriesId, observations[0]?.value]),
      ).toEqual([
        ["A1000001A", 1],
        ["A1000002B", 2],
      ]);
    }),
  );

  it.effect(
    "titles a series from the latest release when an older one has a lower table order",
    () =>
      Effect.gen(function* () {
        const tableUrl = "https://www.abs.gov.au/synthetic/latest-release/123401.xlsx";

        const row = (releaseDate: string, title: string, tableOrder: number) =>
          `<Series><ProductReleaseDate>${releaseDate}</ProductReleaseDate><TableURL>${tableUrl}</TableURL><TableTitle>${title}</TableTitle><TableOrder>${tableOrder}</TableOrder><SeriesID>A1000001A</SeriesID></Series>`;

        const http = fixtureHttpClient(
          new Map<string, RecordedResponse>([
            [
              directoryUrl({ sid: "A1000001A" }),
              {
                status: 200,
                body: `<?xml version="1.0" encoding="utf-8" ?><TimeSeriesIndex>${row("15/01/2026", "Table 1. Superseded", 1)}${row("15/04/2026", "Table 1. Current", 2)}</TimeSeriesIndex>`,
              },
            ],
            [
              tableUrl,
              {
                status: 200,
                body: syntheticTable([
                  ["Data1", absDataSheet([syntheticSeries("A1000001A")], [[46023, 1]])],
                ]),
              },
            ],
          ]),
        );

        const series = yield* readAbs(AbsRequest.Series({ seriesIds: ["A1000001A"] })).pipe(
          Effect.provide(http.layer),
        );

        expect(series.map(({ table }) => table)).toEqual([
          { tableId: "123401", tableTitle: "Table 1. Current" },
        ]);
      }),
  );

  it.effect("upper-cases lower-case series IDs", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const series = yield* readAbs(AbsRequest.Series({ seriesIds: ["a2454446f"] })).pipe(
        Effect.provide(http.layer),
      );

      expect(countBySeries(series)).toEqual({ A2454446F: 268 });
    }),
  );

  it.effect("fails once with SeriesNotFound naming every unknown series ID", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(seriesResponses());

      const error = yield* readAbs(
        AbsRequest.Series({ seriesIds: ["A2325807L", "A2603039T", "Z9999999Z"] }),
      ).pipe(Effect.flip, Effect.provide(http.layer));

      expect(error).toBeInstanceOf(SeriesNotFound);
      expect(error).toHaveProperty("seriesIds", ["A2325807L", "Z9999999Z"]);
      expect(http.requests.some((request) => request.url.endsWith(".xlsx"))).toBe(false);
    }),
  );
});
