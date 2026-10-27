import {
  AbsRequest,
  AbsUnavailable,
  CatalogueNotFound,
  CatalogueNumber,
  InvalidRequest,
  type ReadAbsError,
  Series,
  SeriesId,
  SeriesNotFound,
  TableId,
  TableLayoutError,
  TableNotFound,
  TableNumber,
  TimeSeriesDirectoryError,
} from "@ausecon/core";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { fakeReader, noReads } from "../fake-reader";
import { runCli } from "../run-cli";

const TABLE_1_TITLE =
  "Table 1. Total Hourly Rates of Pay Excluding Bonuses: Sector, Original, Seasonally Adjusted and Trend";

/** A Series with a table title that holds commas, as the Time Series Directory names it. */
const WAGES = Schema.decodeSync(Series)({
  seriesId: "A2603039T",
  seriesDescription: "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;",
  unit: "Index Numbers",
  seriesType: "Original",
  dataType: "INDEX",
  frequency: "Quarter",
  collectionMonth: "3",
  table: { tableId: "634501", tableTitle: TABLE_1_TITLE },
  sheet: "Data1",
  observations: [
    { date: "1997-09-01", value: 67.4 },
    { date: "1997-12-01", value: 68 },
  ],
});

/** A Series from a table with no title, as the public parser can return it. */
const LOCAL = Schema.decodeSync(Series)({
  seriesId: "A1000001A",
  seriesDescription: "Employed persons ;",
  unit: "000",
  seriesType: "Trend",
  dataType: "STOCK",
  frequency: "Month",
  collectionMonth: "1",
  table: { tableId: "6202001" },
  sheet: "Data2",
  observations: [{ date: "2026-01-01", value: -1.5 }],
});

const METADATA_HEADER =
  "tableId,sheet,tableTitle,date,seriesDescription,value,seriesType,dataType,collectionMonth,frequency,seriesId,unit";

const ISSUES = "https://github.com/jackemcpherson/ausecon/issues";

const ANSI_ESCAPE = "\u001B[";

const reading = (series: ReadonlyArray<Series>) => fakeReader(Effect.succeed(series));

describe("ausecon abs get output", () => {
  it.effect("writes one CSV row per observation with a header row by default", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0"],
        reading([WAGES, LOCAL]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\n")).toEqual([
        METADATA_HEADER,
        `634501,Data1,"${TABLE_1_TITLE}",1997-09-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;,67.4,Original,INDEX,3,Quarter,A2603039T,Index Numbers`,
        `634501,Data1,"${TABLE_1_TITLE}",1997-12-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;,68,Original,INDEX,3,Quarter,A2603039T,Index Numbers`,
        "6202001,Data2,,2026-01-01,Employed persons ;,-1.5,Trend,STOCK,1,Month,A1000001A,000",
      ]);
    }),
  );

  it.effect("writes only the header when the read returns no Series", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--catalogue", "6345.0"], reading([]).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(METADATA_HEADER);
    }),
  );

  it.effect("quotes a CSV field that holds a quote or a line break", () =>
    Effect.gen(function* () {
      const awkward = { ...LOCAL, seriesDescription: 'First "line" ;\nsecond line ;' };

      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6202.0"],
        reading([awkward]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        `${METADATA_HEADER}\n` +
          '6202001,Data2,,2026-01-01,"First ""line"" ;\nsecond line ;",-1.5,Trend,STOCK,1,Month,A1000001A,000',
      );
    }),
  );

  it.effect(
    "quotes a CSV field whose only special character is a line feed or carriage return",
    () =>
      Effect.gen(function* () {
        const result = yield* runCli(
          ["abs", "get", "--catalogue", "6202.0"],
          reading([
            { ...LOCAL, seriesDescription: "first\nsecond" },
            { ...LOCAL, seriesDescription: "first\rsecond" },
          ]).layer,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe(
          `${METADATA_HEADER}\n` +
            '6202001,Data2,,2026-01-01,"first\nsecond",-1.5,Trend,STOCK,1,Month,A1000001A,000\n' +
            '6202001,Data2,,2026-01-01,"first\rsecond",-1.5,Trend,STOCK,1,Month,A1000001A,000',
        );
      }),
  );

  it.effect("writes only series ID, date, and value with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--no-metadata"],
        reading([WAGES, LOCAL]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([
        "seriesId,date,value",
        "A2603039T,1997-09-01,67.4",
        "A2603039T,1997-12-01,68",
        "A1000001A,2026-01-01,-1.5",
      ]);
    }),
  );

  it.effect("writes the Series list as compact JSON when stdout is not a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--format", "json"],
        reading([WAGES, LOCAL]).layer,
      );

      const series: unknown = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("\n");
      expect(series).toEqual([WAGES, LOCAL]);
    }),
  );

  it.effect("pretty-prints the Series list as JSON when stdout is a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--format", "json"],
        reading([WAGES]).layer,
        { isTerminal: true },
      );

      const series: unknown = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /^\[\n {2}\{\n {4}"seriesId": "A2603039T",\n {4}"seriesDescription"/u,
      );
      expect(series).toEqual([WAGES]);
    }),
  );

  it.effect("writes each Series with only its series ID and observations with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--format", "json", "--no-metadata"],
        reading([WAGES, LOCAL]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        '[{"seriesId":"A2603039T","observations":[{"date":"1997-09-01","value":67.4},{"date":"1997-12-01","value":68}]},' +
          '{"seriesId":"A1000001A","observations":[{"date":"2026-01-01","value":-1.5}]}]',
      );
    }),
  );
});

describe("ausecon abs get requests", () => {
  it.effect("reads every table of a catalogue number when --table is absent", () =>
    Effect.gen(function* () {
      const reader = reading([]);

      yield* runCli(["abs", "get", "--catalogue", "6345.0"], reader.layer);

      expect(reader.requests).toEqual([
        AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: [] }),
      ]);
    }),
  );

  it.effect("reads only the tables named by repeated --table flags", () =>
    Effect.gen(function* () {
      const reader = reading([]);

      yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--table", "1", "--table", "7a"],
        reader.layer,
      );

      expect(reader.requests).toEqual([
        AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: ["1", "7a"] }),
      ]);
    }),
  );

  it.effect("reads every series named by repeated --series flags, as typed", () =>
    Effect.gen(function* () {
      const reader = reading([]);

      yield* runCli(["abs", "get", "--series", "A2603039T", "--series", "a2454446f"], reader.layer);

      expect(reader.requests).toEqual([
        AbsRequest.Series({ seriesIds: ["A2603039T", "a2454446f"] }),
      ]);
    }),
  );
});

describe("ausecon abs get help", () => {
  it.effect("leads help with examples and warns about large catalogue numbers", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noReads.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^EXAMPLES\n/u);
      expect(result.stdout.indexOf("ausecon abs get --catalogue 6345.0")).toBeLessThan(
        result.stdout.indexOf("USAGE"),
      );
      expect(result.stdout).toContain("6202.0");
      expect(result.stdout).toContain("--no-metadata");
      expect(result.stdout).toContain("ausecon abs get --catalogue 6202.0 --table 1 --table 12");
      expect(result.stdout).toContain("ausecon abs get --series A2603039T --series A2454446F");
      expect(result.stdout).not.toContain(ANSI_ESCAPE);
    }),
  );

  it.effect("colours help on a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noReads.layer, { isTerminal: true });

      expect(result.stdout).toContain(ANSI_ESCAPE);
    }),
  );

  it.effect("turns colour off on a terminal when NO_COLOR is set", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noReads.layer, {
        isTerminal: true,
        env: { NO_COLOR: "1" },
      });

      expect(result.stdout).toContain("EXAMPLES");
      expect(result.stdout).not.toContain(ANSI_ESCAPE);
    }),
  );
});

describe("ausecon abs get usage errors", () => {
  it.effect.each([
    {
      name: "neither --catalogue nor --series",
      argv: ["abs", "get"],
      message: "Pass --catalogue <catalogue number> or --series <series ID>.",
    },
    {
      name: "both --catalogue and --series",
      argv: ["abs", "get", "--catalogue", "6345.0", "--series", "A2603039T"],
      message: "Pass --catalogue or --series, not both.",
    },
    {
      name: "--table without --catalogue",
      argv: ["abs", "get", "--series", "A2603039T", "--table", "1"],
      message: "--table needs --catalogue",
    },
    {
      name: "an unknown --format",
      argv: ["abs", "get", "--catalogue", "6345.0", "--format", "xml"],
      message: "--format",
    },
    {
      name: "an unknown flag",
      argv: ["abs", "get", "--catalogue", "6345.0", "--colour"],
      message: "--colour",
    },
  ])("exits 2 with help on stderr and nothing on stdout for $name", ({ argv, message }) =>
    Effect.gen(function* () {
      const result = yield* runCli(argv, noReads.layer);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("USAGE");
      expect(result.stderr).toContain(message);
      expect(noReads.requests).toEqual([]);
    }),
  );
});

const TABLE_URL =
  "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release/634501.xlsx";

const DIRECTORY_URL = "https://abs.gov.au/servlet/TSSearchServlet?catno=6345.0";

const REPORT_IT = `Report this at ${ISSUES} with the command you ran.`;

describe("ausecon abs get read failures", () => {
  const failures: ReadonlyArray<{
    readonly name: string;
    readonly error: ReadAbsError;
    readonly exitCode: number;
    readonly stderr: string;
  }> = [
    {
      name: "InvalidRequest",
      error: new InvalidRequest({ message: "Expected a catalogue number, got wages" }),
      exitCode: 2,
      stderr:
        "ausecon: Expected a catalogue number, got wages\n" +
        "Run `ausecon abs get --help` for usage and examples.",
    },
    {
      name: "CatalogueNotFound",
      error: new CatalogueNotFound({
        catalogueNumber: Schema.decodeSync(CatalogueNumber)("9999.0"),
      }),
      exitCode: 3,
      stderr:
        "ausecon: The Time Series Directory has no series for catalogue number 9999.0.\n" +
        "Check the catalogue number on the ABS website, such as 6345.0 for the Wage Price Index.",
    },
    {
      name: "TableNotFound",
      error: new TableNotFound({
        catalogueNumber: Schema.decodeSync(CatalogueNumber)("6345.0"),
        tableNumbers: ["6", "X99"].map((value) => Schema.decodeSync(TableNumber)(value)),
      }),
      exitCode: 3,
      stderr:
        "ausecon: Catalogue number 6345.0 has no table numbered 6, X99.\n" +
        "Leave out --table to read every table, then pick table numbers from the tableTitle column.",
    },
    {
      name: "SeriesNotFound",
      error: new SeriesNotFound({
        seriesIds: ["A2325807L", "Z9999999Z"].map((value) => Schema.decodeSync(SeriesId)(value)),
      }),
      exitCode: 3,
      stderr:
        "ausecon: Found no series ID A2325807L, Z9999999Z in the Time Series Directory or the table it names.\n" +
        "Check the series ID in the ABS table that holds it.",
    },
    {
      name: "AbsUnavailable with a status",
      error: new AbsUnavailable({
        url: TABLE_URL,
        status: 404,
        detail: "The ABS answered with status 404.",
      }),
      exitCode: 4,
      stderr:
        `ausecon: Could not read ${TABLE_URL}: The ABS answered with status 404.\n` +
        `Try again later. The ABS website may be down, or the data may have moved: if the error stays, report it at ${ISSUES}.`,
    },
    {
      name: "AbsUnavailable without a status",
      error: new AbsUnavailable({ url: DIRECTORY_URL, detail: "offline" }),
      exitCode: 4,
      stderr:
        `ausecon: Could not read ${DIRECTORY_URL}: offline\n` +
        "Check your network connection, then try again. The ABS website may be down.",
    },
    {
      name: "TimeSeriesDirectoryError",
      error: new TimeSeriesDirectoryError({
        url: DIRECTORY_URL,
        reason: "The Time Series Directory answered: Invalid query.",
      }),
      exitCode: 1,
      stderr:
        `ausecon: Time Series Directory fault at ${DIRECTORY_URL}: The Time Series Directory answered: Invalid query.\n` +
        REPORT_IT,
    },
    {
      name: "TableLayoutError with a sheet",
      error: new TableLayoutError({
        tableId: Schema.decodeSync(TableId)("634501"),
        sheet: "Data1",
        reason: "Column A of row 10 is not `Series ID`.",
      }),
      exitCode: 1,
      stderr:
        "ausecon: Table 634501, sheet Data1, does not have the ABS time series layout: Column A of row 10 is not `Series ID`.\n" +
        REPORT_IT,
    },
    {
      name: "TableLayoutError without a sheet",
      error: new TableLayoutError({
        tableId: Schema.decodeSync(TableId)("634501"),
        reason: "The table cannot be opened as .xlsx.",
      }),
      exitCode: 1,
      stderr:
        "ausecon: Table 634501 does not have the ABS time series layout: The table cannot be opened as .xlsx.\n" +
        REPORT_IT,
    },
  ];

  it.effect.each(failures)(
    "exits $exitCode with a next step and nothing on stdout for $name",
    ({ error, exitCode, stderr }) =>
      Effect.gen(function* () {
        const result = yield* runCli(
          ["abs", "get", "--catalogue", "6345.0"],
          fakeReader(Effect.fail(error)).layer,
        );

        expect(result.exitCode).toBe(exitCode);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(stderr);
      }),
  );

  it.effect("exits 1 and reports a fault when the read fails unexpectedly", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0"],
        fakeReader(Effect.die("boom")).layer,
      );

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("ausecon: failed unexpectedly.");
      expect(result.stderr).toContain("boom");
      expect(result.stderr).toContain(`Report this at ${ISSUES}.`);
    }),
  );
});
