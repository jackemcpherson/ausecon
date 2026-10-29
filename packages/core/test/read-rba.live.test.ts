import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

import { RbaRequest, readRba } from "../src/index";

// These tests read the real RBA statistical tables. They run only with AUSECON_LIVE=1.
describe("readRba against the live RBA", () => {
  it.effect("reads one RBA table number", () =>
    Effect.gen(function* () {
      const series = yield* readRba(RbaRequest.Table({ tableNumbers: ["F1"] })).pipe(
        Effect.provide(FetchHttpClient.layer),
      );

      expect(series.length).toBeGreaterThan(0);
      expect(new Set(series.map(({ table }) => table.tableNumber))).toEqual(new Set(["F1"]));
      expect(series.map(({ seriesId }) => seriesId)).toContain("FIRMMCRTD");
    }),
  );

  it.effect("reads the cash rate target by its series ID", () =>
    Effect.gen(function* () {
      const series = yield* readRba(RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] })).pipe(
        Effect.provide(FetchHttpClient.layer),
      );

      expect(
        series.map(({ seriesId, unit, table }) => [seriesId, unit, table.tableNumber]),
      ).toEqual([["FIRMMCRTD", "Per cent", "F1"]]);
      // F1 starts the series in January 2011 and gains one value per business day.
      expect(series[0]?.observations.length).toBeGreaterThan(3500);
      expect(series[0]?.observations[0]).toEqual({ date: "2011-01-04", value: 4.75 });
      expect(series[0]?.publicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }),
  );
});
