import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { InvalidRequest, resolveSeriesId } from "../src/index";

describe("resolveSeriesId", () => {
  const resolved: ReadonlyArray<readonly [string, string, string, string]> = [
    ["a bare ABS series ID", "A84423050A", "ABS", "A84423050A"],
    ["a lower-case ABS series ID", " a84423050a ", "ABS", "A84423050A"],
    ["a bare RBA series ID", "FIRMMCRTD", "RBA", "FIRMMCRTD"],
    ["a lower-case RBA series ID", "firmmcrtd", "RBA", "FIRMMCRTD"],
    ["an RBA series ID that ends in a digit", "FIRMMTN1", "RBA", "FIRMMTN1"],
    ["an `abs:` prefix on an RBA-pattern ID", "abs:FIRMMCRTD", "ABS", "FIRMMCRTD"],
    ["an `ABS:` prefix on an ABS series ID", "ABS:a84423050a", "ABS", "A84423050A"],
    ["an `rba:` prefix on an ABS-pattern ID", "rba:A84423050A", "RBA", "A84423050A"],
    ["an `Rba:` prefix on an RBA series ID", "Rba:firmmcrtd", "RBA", "FIRMMCRTD"],
  ];

  for (const [name, input, publisher, seriesId] of resolved) {
    it.effect(`resolves ${name}`, () =>
      Effect.gen(function* () {
        expect(yield* resolveSeriesId(input)).toEqual({ publisher, seriesId });
      }),
    );
  }

  const invalid: ReadonlyArray<readonly [string, string]> = [
    ["a catalogue number", "6202.0"],
    ["an empty string", ""],
    ["a prefix without a series ID", "rba:"],
    ["an unknown prefix", "asx:FIRMMCRTD"],
    ["a doubled prefix", "abs:rba:FIRMMCRTD"],
  ];

  for (const [name, input] of invalid) {
    it.effect(`fails with InvalidRequest for ${name}`, () =>
      Effect.gen(function* () {
        const error = yield* resolveSeriesId(input).pipe(Effect.flip);

        expect(error).toBeInstanceOf(InvalidRequest);
      }),
    );
  }
});
