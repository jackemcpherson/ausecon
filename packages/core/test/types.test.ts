import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  AbsSeries,
  CatalogueNumber,
  RbaSeries,
  RbaTableNumber,
  Series,
  SeriesId,
  TableNumber,
} from "../src/types";

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

  it("accepts an RBA series ID", () => {
    expect(Schema.is(SeriesId)("FIRMMCRTD")).toBe(true);
  });

  it("rejects a series ID with punctuation", () => {
    expect(Schema.is(SeriesId)("A2603-039T")).toBe(false);
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

describe("RbaTableNumber", () => {
  it.each(["A1", "F1", "F1.1", "F11.1", "D14.1", "B13.2.1"])("accepts %s", (tableNumber) => {
    expect(Schema.is(RbaTableNumber)(tableNumber)).toBe(true);
  });

  it.each(["f1.1", "F", "1.1", "F1-1", "Table 1", "F1.1.1.1"])("rejects %s", (tableNumber) => {
    expect(Schema.is(RbaTableNumber)(tableNumber)).toBe(false);
  });
});

describe("Series", () => {
  const ABS_SERIES = {
    publisher: "ABS",
    seriesId: "A84423050A",
    description: "Employed total ;  Persons ;",
    unit: "000",
    seriesType: "Seasonally Adjusted",
    dataType: "STOCK",
    frequency: "Month",
    collectionMonth: "1",
    table: { tableId: "6202001" },
    sheet: "Data1",
    observations: [{ date: "2026-09-01", value: 14_600.1 }],
  };

  it("keeps the shared fields and the ABS fields on AbsSeries", () => {
    expect(Object.keys(AbsSeries.fields)).toEqual([
      "publisher",
      "seriesId",
      "description",
      "unit",
      "seriesType",
      "dataType",
      "frequency",
      "collectionMonth",
      "table",
      "sheet",
      "observations",
    ]);
  });

  it("keeps the shared fields in AbsSeries order and adds the RBA fields on RbaSeries", () => {
    expect(Object.keys(RbaSeries.fields)).toEqual([
      "publisher",
      "seriesId",
      "title",
      "description",
      "unit",
      "seriesType",
      "frequency",
      "source",
      "publicationDate",
      "table",
      "observations",
    ]);
  });

  it("accepts an RBA series", () => {
    expect(
      Schema.is(Series)({
        publisher: "RBA",
        seriesId: "FIRMMCRTD",
        title: "Cash Rate Target",
        description: "Cash Rate Target on date",
        unit: "Per cent",
        seriesType: "Original",
        frequency: "Daily",
        source: "RBA",
        publicationDate: "2026-10-29",
        table: {
          tableNumber: "F1",
          tableTitle: "Interest Rates and Yields – Money Market – Daily",
        },
        observations: [{ date: "2026-10-28", value: 4.6 }],
      }),
    ).toBe(true);
  });

  it("accepts an ABS series", () => {
    expect(Schema.is(Series)(ABS_SERIES)).toBe(true);
  });

  it("rejects a series without a publisher", () => {
    const { publisher: _publisher, ...untagged } = ABS_SERIES;

    expect(Schema.is(Series)(untagged)).toBe(false);
  });
});
