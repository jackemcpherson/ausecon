import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { CatalogueNumber, SeriesId, TableNumber } from "../src/types";

describe("CatalogueNumber", () => {
  it("accepts a release catalogue number", () => {
    expect(Schema.is(CatalogueNumber)("6202.0")).toBe(true);
  });

  it("accepts a detailed product catalogue number", () => {
    expect(Schema.is(CatalogueNumber)("6291.0.55.001")).toBe(true);
  });

  it("rejects a catalogue number without its decimal part", () => {
    expect(Schema.is(CatalogueNumber)("6202")).toBe(false);
  });
});

describe("SeriesId", () => {
  it("accepts an ABS series ID", () => {
    expect(Schema.is(SeriesId)("A84423050A")).toBe(true);
  });

  it("rejects a lowercase series ID", () => {
    expect(Schema.is(SeriesId)("a84423050a")).toBe(false);
  });
});

describe("TableNumber", () => {
  it("accepts a table number with a letter suffix", () => {
    expect(Schema.is(TableNumber)("5a")).toBe(true);
  });

  it("accepts a table number with an uppercase letter suffix", () => {
    expect(Schema.is(TableNumber)("10C")).toBe(true);
  });

  it("accepts a table number with a letter prefix", () => {
    expect(Schema.is(TableNumber)("X28")).toBe(true);
  });

  it("accepts a table number with an underscore suffix", () => {
    expect(Schema.is(TableNumber)("021_MTH")).toBe(true);
  });

  it("rejects a decimal table number", () => {
    expect(Schema.is(TableNumber)("12.1")).toBe(false);
  });

  it("rejects a table title", () => {
    expect(Schema.is(TableNumber)("Table 1")).toBe(false);
  });
});
