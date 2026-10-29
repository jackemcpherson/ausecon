import { describe, expect, it } from "@effect/vitest";

import { searchSeries, type SeriesIndexEntry } from "../src/index";

const matchesEveryWord = (entry: SeriesIndexEntry, words: ReadonlyArray<string>): boolean => {
  const fields = [entry.seriesId, entry.title, entry.description, entry.tableTitle].map((field) =>
    field.toLowerCase(),
  );

  return words.every((word) => fields.some((field) => field.includes(word.toLowerCase())));
};

describe("searchSeries", () => {
  it("finds the cash rate target by words in its title", () => {
    const results = searchSeries(["cash", "rate", "target"]);
    const cashRateTarget = results.find(({ seriesId }) => seriesId === "FIRMMCRTD");

    expect(cashRateTarget).toMatchObject({
      publisher: "RBA",
      seriesId: "FIRMMCRTD",
      title: "Cash Rate Target",
      unit: "Per cent",
      frequency: "Daily",
      tableNumber: "F1",
      tableTitle: "Interest Rates and Yields – Money Market – Daily",
    });
  });

  it("returns only entries that hold every word in one of their fields", () => {
    const words = ["interbank", "overnight", "rate"];
    const results = searchSeries(words);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((entry) => matchesEveryWord(entry, words))).toBe(true);
  });

  it("matches words against the table title", () => {
    // FIRMMCRTD's own fields never say "money market": only the F1 title does.
    const results = searchSeries(["money", "market", "cash", "rate", "target"]);

    expect(results.map(({ seriesId }) => seriesId)).toContain("FIRMMCRTD");
  });

  it("matches the series ID", () => {
    expect(searchSeries(["firmmcrtd"]).map(({ seriesId }) => seriesId)).toContain("FIRMMCRTD");
  });

  it("ignores the case of the words", () => {
    expect(searchSeries(["CASH", "Rate", "tArGeT"])).toEqual(
      searchSeries(["cash", "rate", "target"]),
    );
  });

  it("keeps index order, and the limit caps the results", () => {
    const all = searchSeries([]);
    const cash = searchSeries(["cash"]);

    expect(cash.length).toBeGreaterThan(2);
    expect(all.filter((entry) => cash.includes(entry))).toEqual(cash);
    expect(searchSeries(["cash"], { limit: 2 })).toEqual(cash.slice(0, 2));
    expect(searchSeries(["cash"], { limit: 0 })).toEqual([]);
  });

  it("returns every entry when given no words", () => {
    expect(searchSeries([]).length).toBeGreaterThan(0);
    expect(searchSeries([], { limit: 1 })).toHaveLength(1);
  });

  it("returns nothing when a word matches no entry", () => {
    expect(searchSeries(["cash", "zzqxnotaword"])).toEqual([]);
  });
});
