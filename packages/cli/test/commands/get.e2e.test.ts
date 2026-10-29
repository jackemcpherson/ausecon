import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fixtureHttpClient, rbaTableResponses, rbaTableUrl } from "@ausecon/testkit";

import { Reader } from "../../src/reader";
import { runCli } from "../run-cli";

// Checked by hand against f01d.xlsx sheet Data: column B (FIRMMCRTD) starts
// on 2011-01-04 at 4.75 per cent.
const FIRST_ROW =
  "RBA,F1,Interest Rates and Yields – Money Market – Daily,2011-01-04,Cash Rate Target on date,4.75,Original,Daily,FIRMMCRTD,Per cent";

describe("ausecon get on the recorded F1 statistical table", () => {
  it.effect("reads an RBA series ID through the live reader and writes it as CSV", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(rbaTableResponses());
      const reader = Reader.layer.pipe(Layer.provide(http.layer));

      const result = yield* runCli(["get", "rba:firmmcrtd"], reader);
      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(http.requests.map(({ url }) => url)).toEqual([rbaTableUrl("F1")]);
      expect(lines[0]).toBe(
        "publisher,table,tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit",
      );
      expect(lines[1]).toBe(FIRST_ROW);
      expect(lines.slice(1).every((line) => line.includes(",FIRMMCRTD,"))).toBe(true);
    }),
  );
});
