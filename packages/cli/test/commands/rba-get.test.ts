import {
  InvalidRequest,
  RbaRequest,
  RbaSeries,
  RbaSeriesNotFound,
  RbaTableLayoutError,
  RbaTableNotFound,
  RbaTableNumber,
  RbaUnavailable,
  type ReadRbaError,
  SeriesId,
} from "@ausecon/core";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { fakeReader, noReads } from "../fake-reader";
import { runCli } from "../run-cli";

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
  observations: [
    { date: "2011-01-04", value: 4.75 },
    { date: "2026-10-28", value: 4.6 },
  ],
});

/** A Series whose title holds a comma, from a source other than the RBA. */
const RURAL_DEBT = Schema.decodeSync(RbaSeries)({
  publisher: "RBA",
  seriesId: "DRDAB",
  title: "Rural debt, all banks",
  description: "Rural debt by all banks",
  unit: "$ million",
  seriesType: "Original",
  frequency: "Annual",
  source: "APRA",
  publicationDate: "2025-11-28",
  table: { tableNumber: "D9", tableTitle: "Rural Debt by Lender" },
  observations: [{ date: "1965-06-30", value: 656 }],
});

const METADATA_HEADER =
  "tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit,title,source,publicationDate";

const ISSUES = "https://github.com/jackemcpherson/ausecon/issues";

const reading = (series: ReadonlyArray<RbaSeries>) => fakeReader({ rba: Effect.succeed(series) });

const tableNumber = Schema.decodeSync(RbaTableNumber);

const seriesId = Schema.decodeSync(SeriesId);

describe("ausecon rba get output", () => {
  it.effect("writes the shared columns, then the RBA metadata, as CSV by default", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["rba", "get", "F1", "D9"],
        reading([CASH_RATE, RURAL_DEBT]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.split("\n")).toEqual([
        METADATA_HEADER,
        "Interest Rates and Yields – Money Market – Daily,2011-01-04,Cash Rate Target on date,4.75,Original,Daily,FIRMMCRTD,Per cent,Cash Rate Target,RBA,2026-10-29",
        "Interest Rates and Yields – Money Market – Daily,2026-10-28,Cash Rate Target on date,4.6,Original,Daily,FIRMMCRTD,Per cent,Cash Rate Target,RBA,2026-10-29",
        'Rural Debt by Lender,1965-06-30,Rural debt by all banks,656,Original,Annual,DRDAB,$ million,"Rural debt, all banks",APRA,2025-11-28',
      ]);
    }),
  );

  it.effect("writes only the header when the read returns no Series", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["rba", "get", "F1"], reading([]).layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(METADATA_HEADER);
    }),
  );

  it.effect("writes only series ID, date, and value with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["rba", "get", "F1", "D9", "--no-metadata"],
        reading([CASH_RATE, RURAL_DEBT]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.split("\n")).toEqual([
        "seriesId,date,value",
        "FIRMMCRTD,2011-01-04,4.75",
        "FIRMMCRTD,2026-10-28,4.6",
        "DRDAB,1965-06-30,656",
      ]);
    }),
  );

  it.effect("writes the Series list as compact JSON when stdout is not a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["rba", "get", "F1", "--format", "json"],
        reading([CASH_RATE, RURAL_DEBT]).layer,
      );

      const series: unknown = JSON.parse(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("\n");
      expect(series).toEqual([CASH_RATE, RURAL_DEBT]);
    }),
  );

  it.effect("pretty-prints the Series list as JSON when stdout is a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["rba", "get", "F1", "--format", "json"],
        reading([CASH_RATE]).layer,
        { isTerminal: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /^\[\n {2}\{\n {4}"publisher": "RBA",\n {4}"seriesId": "FIRMMCRTD"/u,
      );
      expect(JSON.parse(result.stdout)).toEqual([CASH_RATE]);
    }),
  );

  it.effect("writes each Series with only its series ID and observations with --no-metadata", () =>
    Effect.gen(function* () {
      const result = yield* runCli(
        ["rba", "get", "F1", "--format", "json", "--no-metadata"],
        reading([CASH_RATE]).layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(
        '[{"seriesId":"FIRMMCRTD","observations":[{"date":"2011-01-04","value":4.75},{"date":"2026-10-28","value":4.6}]}]',
      );
    }),
  );
});

describe("ausecon rba get requests", () => {
  it.effect("reads every RBA table number, as typed, in one request", () =>
    Effect.gen(function* () {
      const reader = reading([]);

      yield* runCli(["rba", "get", "F1", "f1.1", "D9"], reader.layer);

      expect(reader.requests).toEqual([RbaRequest.Table({ tableNumbers: ["F1", "f1.1", "D9"] })]);
    }),
  );
});

describe("ausecon rba get help", () => {
  it.effect("leads help with an RBA example", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["rba", "get", "--help"], noReads.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^EXAMPLES\n/u);
      expect(result.stdout.indexOf("ausecon rba get F1")).toBeLessThan(
        result.stdout.indexOf("USAGE"),
      );
      expect(result.stdout).toContain("rba-table-number");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--no-metadata");
    }),
  );
});

describe("ausecon rba get usage errors", () => {
  it.effect.each([
    { name: "no RBA table number", argv: ["rba", "get"], message: "rba-table-number" },
    {
      name: "an invalid RBA table number",
      argv: ["rba", "get", "F1", "cash", "F1.1.1.1"],
      message: "Expected an RBA table number such as F1 or F1.1, got cash, F1.1.1.1.",
    },
    {
      name: "an unknown --format",
      argv: ["rba", "get", "F1", "--format", "xml"],
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

const TABLE_URL = "https://www.rba.gov.au/statistics/tables/xls/f01d.xlsx";

const REPORT_IT = `Report this at ${ISSUES} with the command you ran.`;

const UPDATE_AUSECON = "update ausecon with `npm install --global ausecon@latest`, then try again.";

describe("ausecon rba get read failures", () => {
  const failures: ReadonlyArray<{
    readonly name: string;
    readonly error: ReadRbaError;
    readonly exitCode: number;
    readonly stderr: string;
  }> = [
    {
      name: "InvalidRequest",
      error: new InvalidRequest({ message: "Expected an RBA table number, got F" }),
      exitCode: 2,
      stderr:
        "ausecon: Expected an RBA table number, got F\n" +
        "Run `ausecon rba get --help` for usage and examples.",
    },
    {
      name: "RbaTableNotFound from the series index",
      error: new RbaTableNotFound({ tableNumbers: [tableNumber("Z9"), tableNumber("Z9.1")] }),
      exitCode: 3,
      stderr:
        "ausecon: No current RBA statistical table has the RBA table number Z9, Z9.1. " +
        "The series index may be out of date: a newer ausecon release may find it.\n" +
        `Check the RBA table number on the RBA website, such as F1 for the cash rate. If it is right, ${UPDATE_AUSECON}`,
    },
    {
      name: "RbaTableNotFound from a 404",
      error: new RbaTableNotFound({ tableNumbers: [tableNumber("F1")], url: TABLE_URL }),
      exitCode: 3,
      stderr:
        `ausecon: The RBA answered 404 for table F1 at ${TABLE_URL}. ` +
        "The series index may be out of date: a newer ausecon release may find it.\n" +
        `The RBA may have moved the table: ${UPDATE_AUSECON}`,
    },
    {
      name: "RbaSeriesNotFound",
      error: new RbaSeriesNotFound({ seriesIds: [seriesId("FIRMMCRTX")] }),
      exitCode: 3,
      stderr:
        "ausecon: No current RBA statistical table holds the series ID FIRMMCRTX. " +
        "The series index may be out of date: a newer ausecon release may find it.\n" +
        `Find the series ID with \`ausecon search\`. If it is right, ${UPDATE_AUSECON}`,
    },
    {
      name: "RbaUnavailable with a status",
      error: new RbaUnavailable({
        url: TABLE_URL,
        status: 503,
        detail: "The RBA answered with status 503.",
      }),
      exitCode: 4,
      stderr:
        `ausecon: Could not read ${TABLE_URL}: The RBA answered with status 503.\n` +
        `Try again later. The RBA website may be down, or the data may have moved: if the error stays, report it at ${ISSUES}.`,
    },
    {
      name: "RbaUnavailable without a status",
      error: new RbaUnavailable({ url: TABLE_URL, detail: "offline" }),
      exitCode: 4,
      stderr:
        `ausecon: Could not read ${TABLE_URL}: offline\n` +
        "Check your network connection, then try again. The RBA website may be down.",
    },
    {
      name: "RbaTableLayoutError",
      error: new RbaTableLayoutError({
        tableNumber: tableNumber("F1"),
        url: TABLE_URL,
        reason: "The table has no Data sheet.",
      }),
      exitCode: 1,
      stderr:
        `ausecon: Statistical table F1 at ${TABLE_URL} does not have the RBA layout: The table has no Data sheet.\n` +
        REPORT_IT,
    },
  ];

  it.effect.each(failures)(
    "exits $exitCode with a next step and nothing on stdout for $name",
    ({ error, exitCode, stderr }) =>
      Effect.gen(function* () {
        const result = yield* runCli(
          ["rba", "get", "F1"],
          fakeReader({ rba: Effect.fail(error) }).layer,
        );

        expect(result.exitCode).toBe(exitCode);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(stderr);
      }),
  );
});
