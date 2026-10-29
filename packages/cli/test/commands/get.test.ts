import {
  AbsRequest,
  AbsSeries,
  AbsUnavailable,
  InvalidRequest,
  RbaRequest,
  RbaSeries,
  RbaSeriesNotFound,
  type ReadAbsError,
  type ReadRbaError,
  SeriesId,
  SeriesNotFound,
} from "@ausecon/core";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { fakeReader, noReads } from "../fake-reader";
import { runCli } from "../run-cli";

/** An ABS Series with a table title that holds commas. */
const WAGES = Schema.decodeSync(AbsSeries)({
  publisher: "ABS",
  seriesId: "A2603039T",
  description: "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;",
  unit: "Index Numbers",
  seriesType: "Original",
  dataType: "INDEX",
  frequency: "Quarter",
  collectionMonth: "3",
  table: { tableId: "634501", tableTitle: "Table 1. Hourly Rates of Pay: Sector, Original" },
  sheet: "Data1",
  observations: [{ date: "1997-09-01", value: 67.4 }],
});

/** The same ABS series ID on a second sheet, from a table with no title. */
const WAGES_AGAIN = Schema.decodeSync(AbsSeries)({
  ...WAGES,
  table: { tableId: "634502" },
  sheet: "Data2",
  observations: [{ date: "1997-12-01", value: 68 }],
});

/** A second ABS series. */
const EMPLOYED = Schema.decodeSync(AbsSeries)({
  publisher: "ABS",
  seriesId: "A1000001A",
  description: "Employed persons ;",
  unit: "000",
  seriesType: "Trend",
  dataType: "STOCK",
  frequency: "Month",
  collectionMonth: "1",
  table: { tableId: "6202001" },
  sheet: "Data1",
  observations: [{ date: "2026-01-01", value: -1.5 }],
});

/** The cash rate target, as F1 names it. */
const CASH_RATE = Schema.decodeSync(RbaSeries)({
  publisher: "RBA",
  seriesId: "FIRMMCRTD",
  title: "Cash Rate Target",
  description: "Cash Rate Target on date",
  unit: "Per cent",
  seriesType: "Original",
  frequency: "Daily",
  source: "RBA",
  publicationDate: "2026-10-29",
  table: { tableNumber: "F1", tableTitle: "Interest Rates and Yields – Money Market – Daily" },
  observations: [{ date: "2026-10-28", value: 4.6 }],
});

const METADATA_HEADER =
  "publisher,table,tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit";

const WAGES_ROW =
  'ABS,634501,"Table 1. Hourly Rates of Pay: Sector, Original",1997-09-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;,67.4,Original,Quarter,A2603039T,Index Numbers';

const WAGES_AGAIN_ROW =
  "ABS,634502,,1997-12-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;,68,Original,Quarter,A2603039T,Index Numbers";

const EMPLOYED_ROW = "ABS,6202001,,2026-01-01,Employed persons ;,-1.5,Trend,Month,A1000001A,000";

const CASH_RATE_ROW =
  "RBA,F1,Interest Rates and Yields – Money Market – Daily,2026-10-28,Cash Rate Target on date,4.6,Original,Daily,FIRMMCRTD,Per cent";

const UPDATE_AUSECON = "update ausecon with `npm install --global ausecon@latest`, then try again.";

/**
 * A reader that answers each publisher with its Series. The ABS answers in
 * an order other than the request order, as `readAbs` may.
 */
const reading = () =>
  fakeReader({
    abs: Effect.succeed([EMPLOYED, WAGES, WAGES_AGAIN]),
    rba: Effect.succeed([CASH_RATE]),
  });

const seriesId = Schema.decodeSync(SeriesId);

describe("ausecon get output", () => {
  it.effect("writes Series from both publishers in request order, under one header", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["get", "FIRMMCRTD", "A2603039T", "A1000001A"], reading().layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\n")).toEqual([
        METADATA_HEADER,
        CASH_RATE_ROW,
        WAGES_ROW,
        WAGES_AGAIN_ROW,
        EMPLOYED_ROW,
      ]);
    }),
  );

  it.effect("writes a series ID passed twice once, at its first position", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["get", "A1000001A", "FIRMMCRTD", "a1000001a", "rba:firmmcrtd"],
        reading().layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([METADATA_HEADER, EMPLOYED_ROW, CASH_RATE_ROW]);
    }),
  );

  it.effect("writes only series ID, date, and value with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["get", "A1000001A", "FIRMMCRTD", "--no-metadata"],
        reading().layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([
        "seriesId,date,value",
        "A1000001A,2026-01-01,-1.5",
        "FIRMMCRTD,2026-10-28,4.6",
      ]);
    }),
  );

  it.effect("writes the Series union as JSON, in request order", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["get", "FIRMMCRTD", "A2603039T", "--format", "json"],
        reading().layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("\n");
      expect(JSON.parse(result.stdout)).toEqual([CASH_RATE, WAGES, WAGES_AGAIN]);
    }),
  );

  it.effect("writes each Series with only its series ID and observations with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["get", "FIRMMCRTD", "--format", "json", "--no-metadata"],
        fakeReader({ rba: Effect.succeed([CASH_RATE]) }).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        '[{"seriesId":"FIRMMCRTD","observations":[{"date":"2026-10-28","value":4.6}]}]',
      );
    }),
  );
});

describe("ausecon get requests", () => {
  it.effect("infers each publisher from the series ID and reads each publisher once", () =>
    Effect.gen(function* () {
      const reader = reading();

      yield* runCli(["get", "A2603039T", "firmmcrtd", " a1000001a "], reader.layer);

      expect(reader.requests).toHaveLength(2);
      expect(reader.requests).toEqual(
        expect.arrayContaining([
          AbsRequest.Series({ seriesIds: ["A2603039T", "A1000001A"] }),
          RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] }),
        ]),
      );
    }),
  );

  it.effect("takes the publisher from an abs: or rba: prefix in any case", () =>
    Effect.gen(function* () {
      const reader = reading();

      const result = yield* runCli(["get", "ABS:A2603039T", "Rba:FIRMMCRTD"], reader.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([
        METADATA_HEADER,
        WAGES_ROW,
        WAGES_AGAIN_ROW,
        CASH_RATE_ROW,
      ]);
      expect(reader.requests).toEqual(
        expect.arrayContaining([
          AbsRequest.Series({ seriesIds: ["A2603039T"] }),
          RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] }),
        ]),
      );
    }),
  );

  it.effect("reads only the RBA when every series ID is an RBA series ID", () =>
    Effect.gen(function* () {
      const reader = fakeReader({ rba: Effect.succeed([CASH_RATE]) });

      const result = yield* runCli(["get", "FIRMMCRTD"], reader.layer);

      expect(result.exitCode).toBe(0);
      expect(reader.requests).toEqual([RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] })]);
    }),
  );

  it.effect("reads only the ABS when every series ID is an ABS series ID", () =>
    Effect.gen(function* () {
      const reader = fakeReader({ abs: Effect.succeed([EMPLOYED]) });

      const result = yield* runCli(["get", "A1000001A"], reader.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([METADATA_HEADER, EMPLOYED_ROW]);
      expect(reader.requests).toEqual([AbsRequest.Series({ seriesIds: ["A1000001A"] })]);
    }),
  );
});

describe("ausecon get help", () => {
  it.effect("leads help with a mixed ABS and RBA example", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["get", "--help"], noReads.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^EXAMPLES\n/u);
      expect(result.stdout.indexOf("ausecon get A2603039T FIRMMCRTD")).toBeLessThan(
        result.stdout.indexOf("USAGE"),
      );
      expect(result.stdout).toContain("series-id");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--no-metadata");
    }),
  );

  it.effect("lists get under the root command", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["--help"], noReads.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^\s+get\b/mu);
    }),
  );
});

describe("ausecon get usage errors", () => {
  it.effect.each([
    { name: "no series ID", argv: ["get"], message: "series-id" },
    {
      name: "invalid series IDs",
      argv: ["get", "A2603039T", "A26-03039T", "rba:"],
      message: "Expected a series ID such as A2603039T or FIRMMCRTD, got A26-03039T, rba:.",
    },
    {
      name: "an unknown --format",
      argv: ["get", "FIRMMCRTD", "--format", "xml"],
      message: "--format",
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

const ISSUES = "https://github.com/jackemcpherson/ausecon/issues";

describe("ausecon get read failures", () => {
  const failures: ReadonlyArray<{
    readonly name: string;
    readonly abs: ReadAbsError | undefined;
    readonly rba: ReadRbaError | undefined;
    readonly exitCode: number;
    readonly stderr: string;
  }> = [
    {
      name: "an InvalidRequest from the ABS",
      abs: new InvalidRequest({ message: "Expected an ABS series ID, got FIRMMCRTD" }),
      rba: undefined,
      exitCode: 2,
      stderr:
        "ausecon: Expected an ABS series ID, got FIRMMCRTD\n" +
        "Run `ausecon get --help` for usage and examples.",
    },
    {
      name: "SeriesNotFound from the ABS",
      abs: new SeriesNotFound({ seriesIds: [seriesId("A9999999Z")] }),
      rba: undefined,
      exitCode: 3,
      stderr:
        "ausecon: Found no series ID A9999999Z in the Time Series Directory or the table it names.\n" +
        "Check the series ID in the ABS table that holds it.",
    },
    {
      name: "AbsUnavailable",
      abs: new AbsUnavailable({ url: "https://abs.gov.au", detail: "offline" }),
      rba: undefined,
      exitCode: 4,
      stderr:
        "ausecon: Could not read https://abs.gov.au: offline\n" +
        "Check your network connection, then try again. The ABS website may be down.",
    },
    {
      name: "an InvalidRequest from the RBA",
      abs: undefined,
      rba: new InvalidRequest({ message: "Expected a series ID, got X" }),
      exitCode: 2,
      stderr:
        "ausecon: Expected a series ID, got X\nRun `ausecon get --help` for usage and examples.",
    },
    {
      name: "RbaSeriesNotFound",
      abs: undefined,
      rba: new RbaSeriesNotFound({ seriesIds: [seriesId("FIRMMCRTD")] }),
      exitCode: 3,
      stderr:
        "ausecon: No current RBA statistical table holds the series ID FIRMMCRTD. " +
        "The series index may be out of date: a newer ausecon release may find it.\n" +
        `Find the series ID with \`ausecon search <word>\`. If it is right, ${UPDATE_AUSECON}`,
    },
  ];

  it.effect.each(failures)(
    "exits $exitCode with a next step and nothing on stdout for $name",
    ({ abs, rba, exitCode, stderr }) =>
      Effect.gen(function* () {
        const reader = fakeReader({
          abs: abs === undefined ? Effect.succeed([WAGES]) : Effect.fail(abs),
          rba: rba === undefined ? Effect.succeed([CASH_RATE]) : Effect.fail(rba),
        });

        const result = yield* runCli(["get", "A2603039T", "FIRMMCRTD"], reader.layer);

        expect(result.exitCode).toBe(exitCode);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(stderr);
      }),
  );

  it.effect("names the report link for an unexpected failure", () =>
    Effect.gen(function* () {
      const reader = fakeReader({ abs: Effect.die("boom"), rba: Effect.succeed([CASH_RATE]) });

      const result = yield* runCli(["get", "A2603039T", "FIRMMCRTD"], reader.layer);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(ISSUES);
    }),
  );
});

describe("ausecon abs get --series", () => {
  it.effect("writes the same stdout as before and a note naming ausecon get on stderr", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--series", "A1000001A"],
        fakeReader({ abs: Effect.succeed([EMPLOYED]) }).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        "tableId,sheet,tableTitle,date,seriesDescription,value,seriesType,dataType,collectionMonth,frequency,seriesId,unit\n" +
          "6202001,Data1,,2026-01-01,Employed persons ;,-1.5,Trend,STOCK,1,Month,A1000001A,000",
      );
      expect(result.stderr).toBe(
        "ausecon: --series is deprecated and the next release removes it. " +
          "Use `ausecon get <series id...>`, which reads ABS and RBA series IDs.",
      );
    }),
  );

  it.effect("writes no note without --series", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6202.0"],
        fakeReader({ abs: Effect.succeed([EMPLOYED]) }).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    }),
  );
});
