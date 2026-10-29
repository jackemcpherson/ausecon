import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fixtureHttpClient, rbaTableResponses, rbaTableUrl } from "@ausecon/testkit";

import { Reader } from "../../src/reader";
import { runCli } from "../run-cli";

const METADATA_HEADER =
  "tableNumber,tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit,title,source,publicationDate";

// Checked by hand against f01d.xlsx sheet Data: column B (FIRMMCRTD) is the
// first series, and its first dated row is 2011-01-04 at 4.75 per cent. The
// publication date is serial 46324.
const FIRST_METADATA_ROW =
  "F1,Interest Rates and Yields – Money Market – Daily,2011-01-04,Cash Rate Target on date,4.75,Original,Daily,FIRMMCRTD,Per cent,Cash Rate Target,RBA,2026-10-29";

// The library returns 45,988 observations across the 17 series of the recorded F1.
const OBSERVATION_COUNT = 45_988;

describe("ausecon rba get on the recorded F1 statistical table", () => {
  it.effect("reads through the live reader and writes every observation as CSV", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(rbaTableResponses());
      const reader = Reader.layer.pipe(Layer.provide(http.layer));

      const result = yield* runCli(["rba", "get", "F1"], reader);
      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(http.requests.map(({ url }) => url)).toEqual([rbaTableUrl("F1")]);
      expect(lines[0]).toBe(METADATA_HEADER);
      expect(lines[1]).toBe(FIRST_METADATA_ROW);
      expect(lines).toHaveLength(OBSERVATION_COUNT + 1);
    }),
  );
});
