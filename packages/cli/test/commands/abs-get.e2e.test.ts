import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fixtureHttpClient, wagePriceIndexResponses } from "@ausecon/testkit";

import { AbsReader } from "../../src/reader";
import { runCli } from "../run-cli";

const METADATA_HEADER =
  "tableId,sheet,tableTitle,date,seriesDescription,value,seriesType,dataType,collectionMonth,frequency,seriesId,unit";

// Checked by hand against cells A11, B1 to B11 of 634501.xlsx sheet Data1. The
// table title holds commas, so CSV quotes it.
const FIRST_METADATA_ROW =
  '634501,Data1,"Table 1. Total Hourly Rates of Pay Excluding Bonuses: Sector, Original, Seasonally Adjusted and Trend",1997-09-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  Australia ;  Private ;  All industries ;,67.4,Original,INDEX,3,Quarter,A2603039T,Index Numbers';

// The library returns 73,357 observations for the recorded 6345.0 release.
const OBSERVATION_COUNT = 73_357;

describe("ausecon abs get on the recorded Wage Price Index release", () => {
  it.effect("reads through the live reader and writes every observation as CSV", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());
      const reader = AbsReader.layer.pipe(Layer.provide(http.layer));

      const result = yield* runCli(["abs", "get", "--catalogue", "6345.0"], reader);
      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(lines[0]).toBe(METADATA_HEADER);
      expect(lines[1]).toBe(FIRST_METADATA_ROW);
      expect(lines).toHaveLength(OBSERVATION_COUNT + 1);
    }),
  );
});
