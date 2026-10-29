import type { SeriesIndexEntry } from "@ausecon/core";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { fakeReader, noReads } from "../fake-reader";
import { runCli } from "../run-cli";

const MONEY_MARKET_DAILY = "Interest Rates and Yields – Money Market – Daily";

/** The cash rate target, as the series index lists it. */
const CASH_RATE_TARGET: SeriesIndexEntry = {
  publisher: "RBA",
  seriesId: "FIRMMCRTD",
  title: "Cash Rate Target",
  description: "Cash Rate Target on date",
  unit: "Per cent",
  frequency: "Daily",
  seriesType: "Original",
  tableNumber: "F1",
  tableTitle: MONEY_MARKET_DAILY,
};

/** A change in the cash rate target, whose description holds a parenthesis. */
const CASH_RATE_CHANGE: SeriesIndexEntry = {
  publisher: "RBA",
  seriesId: "FIRMMCCRT",
  title: "Change in the Cash Rate Target",
  description: "Change in the Cash Rate Target (in percentage points)",
  unit: "Per cent",
  frequency: "as announced",
  seriesType: "Original",
  tableNumber: "F1",
  tableTitle: MONEY_MARKET_DAILY,
};

/** A monthly series whose description holds a comma and a semicolon. */
const CASH_RATE_MONTHLY: SeriesIndexEntry = {
  publisher: "RBA",
  seriesId: "FIRMMCRT",
  title: "Cash Rate Target",
  description: "Cash Rate Target; monthly average, end of month",
  unit: "Per cent",
  frequency: "Monthly",
  seriesType: "Original",
  tableNumber: "F1.1",
  tableTitle: "Interest Rates and Yields – Money Market – Monthly",
};

/** A series whose description is too long for an 80-column terminal. */
const LONG_DESCRIPTION: SeriesIndexEntry = {
  ...CASH_RATE_TARGET,
  seriesId: "FIRMMBAB90D",
  description:
    "Interest rates on bank accepted bills and negotiable certificates of deposit with 90 days to maturity",
};

const ENTRIES = [CASH_RATE_TARGET, CASH_RATE_CHANGE, CASH_RATE_MONTHLY];

const CSV_HEADER =
  "publisher,seriesId,title,description,unit,frequency,seriesType,tableNumber,tableTitle";

const finding = (entries: ReadonlyArray<SeriesIndexEntry>) => fakeReader({ search: entries });

describe("ausecon search in a terminal", () => {
  it.effect("writes aligned columns with a header row when every description fits", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "rate"], finding(ENTRIES).layer, {
        isTerminal: true,
        columns: 120,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\n")).toEqual([
        "SERIES ID  DESCRIPTION                                            UNIT      FREQUENCY     TABLE",
        "FIRMMCRTD  Cash Rate Target on date                               Per cent  Daily         F1",
        "FIRMMCCRT  Change in the Cash Rate Target (in percentage points)  Per cent  as announced  F1",
        "FIRMMCRT   Cash Rate Target; monthly average, end of month        Per cent  Monthly       F1.1",
      ]);
    }),
  );

  it.effect.each([
    { name: "an 80-column terminal", columns: 80 },
    { name: "a terminal that reports no width", columns: 0 },
  ])("cuts descriptions to fit 80 columns, with an ellipsis, for $name", ({ columns }) =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["search", "cash", "rate"],
        finding([...ENTRIES, LONG_DESCRIPTION]).layer,
        { isTerminal: true, columns },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([
        "SERIES ID    DESCRIPTION                           UNIT      FREQUENCY     TABLE",
        "FIRMMCRTD    Cash Rate Target on date              Per cent  Daily         F1",
        "FIRMMCCRT    Change in the Cash Rate Target (in…   Per cent  as announced  F1",
        "FIRMMCRT     Cash Rate Target; monthly average,…   Per cent  Monthly       F1.1",
        "FIRMMBAB90D  Interest rates on bank accepted bil…  Per cent  Daily         F1",
      ]);
    }),
  );

  it.effect("keeps 20 columns of description in a narrow terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "bills"], finding([LONG_DESCRIPTION]).layer, {
        isTerminal: true,
        columns: 40,
      });

      expect(result.stdout.split("\n")[1]).toBe(
        "FIRMMBAB90D  Interest rates on b…  Per cent  Daily      F1",
      );
    }),
  );

  it.effect("writes CSV with --format csv", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["search", "cash", "--format", "csv"],
        finding([CASH_RATE_TARGET]).layer,
        { isTerminal: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")[0]).toBe(CSV_HEADER);
    }),
  );

  it.effect("pretty-prints the entry list with --format json", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["search", "cash", "--format", "json"],
        finding([CASH_RATE_TARGET]).layer,
        { isTerminal: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\[\n {2}\{\n {4}"publisher": "RBA",\n/u);
      expect(JSON.parse(result.stdout)).toEqual([CASH_RATE_TARGET]);
    }),
  );
});

describe("ausecon search in a pipe", () => {
  it.effect("writes every field of each entry as CSV", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "rate"], finding(ENTRIES).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\n")).toEqual([
        CSV_HEADER,
        `RBA,FIRMMCRTD,Cash Rate Target,Cash Rate Target on date,Per cent,Daily,Original,F1,${MONEY_MARKET_DAILY}`,
        `RBA,FIRMMCCRT,Change in the Cash Rate Target,Change in the Cash Rate Target (in percentage points),Per cent,as announced,Original,F1,${MONEY_MARKET_DAILY}`,
        'RBA,FIRMMCRT,Cash Rate Target,"Cash Rate Target; monthly average, end of month",Per cent,Monthly,Original,F1.1,Interest Rates and Yields – Money Market – Monthly',
      ]);
    }),
  );

  it.effect("writes the entry list as compact JSON with --format json", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "--format", "json"], finding(ENTRIES).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("\n");
      expect(JSON.parse(result.stdout)).toEqual(ENTRIES);
    }),
  );
});

describe("ausecon search words", () => {
  it.effect("searches for every word, as typed", () =>
    Effect.gen(function* () {
      const reader = finding(ENTRIES);

      yield* runCli(["search", "Cash", "rate", "TARGET"], reader.layer);

      expect(reader.searches).toEqual([["Cash", "rate", "TARGET"]]);
    }),
  );
});

describe("ausecon search --limit", () => {
  it.effect("shows at most the limit, and says on stderr how to see every match", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "--limit", "2"], finding(ENTRIES).layer, {
        isTerminal: true,
      });

      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(lines).toHaveLength(3);
      expect(lines[1]).toMatch(/^FIRMMCRTD /u);
      expect(lines[2]).toMatch(/^FIRMMCCRT /u);
      expect(result.stderr).toBe(
        "ausecon: Showing 2 of 3 matching series. Pass --limit 3 to show them all.",
      );
    }),
  );

  it.effect("shows 20 series by default", () =>
    Effect.gen(function* () {
      const many = Array.from({ length: 25 }, (_, index) => ({
        ...CASH_RATE_TARGET,
        seriesId: `SERIES${index}`,
      }));

      const result = yield* runCli(["search", "cash"], finding(many).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toHaveLength(21);
      expect(result.stderr).toBe(
        "ausecon: Showing 20 of 25 matching series. Pass --limit 25 to show them all.",
      );
    }),
  );

  it.effect("writes no note when the limit holds every match", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "--limit", "3"], finding(ENTRIES).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toHaveLength(4);
      expect(result.stderr).toBe("");
    }),
  );
});

const NO_MATCH =
  "ausecon: No series in the series index matches cash xyz.\n" +
  "Try fewer or shorter words: each word must appear in a series ID, title, description, or table title. " +
  "The series index holds RBA series only.";

describe("ausecon search with no match", () => {
  it.effect("exits 0 with nothing on stdout and a next step on stderr in a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "xyz"], finding([]).layer, {
        isTerminal: true,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(NO_MATCH);
    }),
  );

  it.effect("writes only the CSV header to a pipe", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "cash", "xyz"], finding([]).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(CSV_HEADER);
      expect(result.stderr).toBe(NO_MATCH);
    }),
  );

  it.effect("writes an empty list with --format json", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["search", "cash", "xyz", "--format", "json"],
        finding([]).layer,
        { isTerminal: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("[]");
      expect(result.stderr).toBe(NO_MATCH);
    }),
  );
});

describe("ausecon search help", () => {
  it.effect("leads help with the cash rate target example", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["search", "--help"], noReads.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^EXAMPLES\n/u);
      expect(result.stdout.indexOf("ausecon search cash rate target")).toBeLessThan(
        result.stdout.indexOf("USAGE"),
      );
      expect(result.stdout).toContain("--limit");
      expect(result.stdout).toContain("--format");
    }),
  );
});

describe("ausecon search usage errors", () => {
  it.effect.each([
    { name: "no words", argv: ["search"], message: "word" },
    {
      name: "a limit of 0",
      argv: ["search", "cash", "--limit", "0"],
      message: "Expected --limit to be 1 or more, got 0.",
    },
    {
      name: "a limit that is not a number",
      argv: ["search", "cash", "--limit", "all"],
      message: "--limit",
    },
    {
      name: "an unknown --format",
      argv: ["search", "cash", "--format", "xml"],
      message: "--format",
    },
  ])("exits 2 with help on stderr and nothing on stdout for $name", ({ argv, message }) =>
    Effect.gen(function* () {
      const result = yield* runCli(argv, noReads.layer);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("USAGE");
      expect(result.stderr).toContain(message);
      expect(noReads.searches).toEqual([]);
    }),
  );
});
