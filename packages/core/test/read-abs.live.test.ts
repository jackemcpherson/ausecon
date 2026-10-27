import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

import { AbsRequest, readAbs } from "../src/index";

// These tests read the real ABS endpoints. They run only with AUSECON_LIVE=1.
describe("readAbs against the live ABS", () => {
  it.effect("reads one table number of a catalogue number", () =>
    Effect.gen(function* () {
      const observations = yield* readAbs(
        AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: ["1"] }),
      ).pipe(Effect.provide(FetchHttpClient.layer));

      expect(observations.length).toBeGreaterThan(0);
      expect(new Set(observations.map((observation) => observation.tableId))).toEqual(
        new Set(["634501"]),
      );
      expect(observations.map((observation) => observation.seriesId)).toContain("A2603039T");
    }),
  );

  it.effect("reads one series ID", () =>
    Effect.gen(function* () {
      const observations = yield* readAbs(AbsRequest.Series({ seriesIds: ["A2603039T"] })).pipe(
        Effect.provide(FetchHttpClient.layer),
      );

      // The series starts in September 1997 and gains one quarter per release.
      expect(observations.length).toBeGreaterThanOrEqual(116);
      expect(new Set(observations.map((observation) => observation.seriesId))).toEqual(
        new Set(["A2603039T"]),
      );
      expect(observations[0]).toMatchObject({ date: "1997-09-01", unit: "Index Numbers" });
    }),
  );
});
