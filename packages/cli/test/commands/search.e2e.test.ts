import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { fixtureHttpClient } from "@ausecon/testkit";

import { Reader } from "../../src/reader";
import { runCli } from "../run-cli";

describe("ausecon search on the series index", () => {
  it.effect("finds the cash rate target through the live reader without a request", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(new Map());
      const reader = Reader.layer.pipe(Layer.provide(http.layer));

      const result = yield* runCli(["search", "cash", "rate", "target"], reader, {
        isTerminal: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^FIRMMCRTD +Cash Rate Target on date +Per cent +Daily +F1$/mu);
      expect(http.requests).toEqual([]);
    }),
  );
});
