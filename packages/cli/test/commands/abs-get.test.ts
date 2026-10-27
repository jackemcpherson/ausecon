import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  type RecordedResponse,
  WAGE_PRICE_INDEX_RELEASE,
  directoryUrl,
  fixtureHttpClient,
  recorded,
  wagePriceIndexResponses,
} from "../../../core/test/fixture-http-client";
import { runCli } from "../run-cli";

const METADATA_HEADER =
  "tableId,sheet,tableTitle,date,seriesDescription,value,seriesType,dataType,collectionMonth,frequency,seriesId,unit";

// Checked by hand against cells A11, B1 to B11 of 634501.xlsx sheet Data1. The
// table title holds commas, so CSV quotes it.
const FIRST_METADATA_ROW =
  '634501,Data1,"Table 1. Total Hourly Rates of Pay Excluding Bonuses: Sector, Original, Seasonally Adjusted and Trend",1997-09-01,Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  Australia ;  Private ;  All industries ;,67.4,Original,INDEX,3,Quarter,A2603039T,Index Numbers';

// The library returns 73,357 observations for the recorded 6345.0 release.
const OBSERVATION_COUNT = 73_357;

const TABLE_1_URL = `${WAGE_PRICE_INDEX_RELEASE}634501.xlsx`;

const ANSI_ESCAPE = "\u001B[";

/** The recorded 6345.0 responses with one response replaced. */
const wagePriceIndexWith = (
  url: string,
  response: RecordedResponse,
): ReadonlyMap<string, RecordedResponse> =>
  new Map([...wagePriceIndexResponses(), [url, response]]);

const noRequests = fixtureHttpClient(new Map());

describe("ausecon abs get --catalogue", () => {
  it.effect("writes every observation as CSV with a header row by default", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const result = yield* runCli(["abs", "get", "--catalogue", "6345.0"], http.layer);
      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(lines[0]).toBe(METADATA_HEADER);
      expect(lines[1]).toBe(FIRST_METADATA_ROW);
      expect(lines).toHaveLength(OBSERVATION_COUNT + 1);
    }),
  );

  it.effect("writes only series ID, date, and value with --no-metadata", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--no-metadata"],
        http.layer,
      );

      const lines = result.stdout.split("\n");

      expect(result.exitCode).toBe(0);
      expect(lines.slice(0, 2)).toEqual(["seriesId,date,value", "A2603039T,1997-09-01,67.4"]);
      expect(lines).toHaveLength(OBSERVATION_COUNT + 1);
    }),
  );

  it.effect("writes one compact JSON array when stdout is not a terminal", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--format", "json", "--no-metadata"],
        http.layer,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("\n");
      expect(result.stdout).toMatch(
        /^\[\{"seriesId":"A2603039T","date":"1997-09-01","value":67\.4\},/u,
      );
    }),
  );

  it.effect("pretty-prints JSON with metadata when stdout is a terminal", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(wagePriceIndexResponses());

      const result = yield* runCli(
        ["abs", "get", "--catalogue", "6345.0", "--format", "json"],
        http.layer,
        { isTerminal: true },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(
        /^\[\n {2}\{\n {4}"tableId": "634501",\n {4}"sheet": "Data1",/u,
      );
    }),
  );

  it.effect("leads help with examples and warns about large catalogue numbers", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noRequests.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toMatch(/^EXAMPLES\n/u);
      expect(result.stdout.indexOf("ausecon abs get --catalogue 6345.0")).toBeLessThan(
        result.stdout.indexOf("USAGE"),
      );
      expect(result.stdout).toContain("6202.0");
      expect(result.stdout).toContain("--no-metadata");
      expect(result.stdout).not.toContain(ANSI_ESCAPE);
    }),
  );

  it.effect("colours help on a terminal", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noRequests.layer, {
        isTerminal: true,
      });

      expect(result.stdout).toContain(ANSI_ESCAPE);
    }),
  );

  it.effect("turns colour off on a terminal when NO_COLOR is set", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--help"], noRequests.layer, {
        isTerminal: true,
        env: { NO_COLOR: "1" },
      });

      expect(result.stdout).toContain("EXAMPLES");
      expect(result.stdout).not.toContain(ANSI_ESCAPE);
    }),
  );
});

describe("ausecon abs get failures", () => {
  it.effect.each([
    { name: "no --catalogue", argv: ["abs", "get"], message: "Pass --catalogue" },
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
      const result = yield* runCli(argv, noRequests.layer);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("USAGE");
      expect(result.stderr).toContain(message);
      expect(noRequests.requests).toEqual([]);
    }),
  );

  it.effect("exits 2 with a next step for a malformed catalogue number", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs", "get", "--catalogue", "wages"], noRequests.layer);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("ausecon abs get --help");
    }),
  );

  it.effect("exits 3 with a next step when the catalogue number has no series", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[directoryUrl({ catno: "9999.0" }), recorded("tsd-catno-9999.0.xml")]]),
      );

      const result = yield* runCli(["abs", "get", "--catalogue", "9999.0"], http.layer);

      expect(result.exitCode).toBe(3);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "ausecon: The Time Series Directory has no series for catalogue number 9999.0.\n" +
          "Check the catalogue number on the ABS website, such as 6345.0 for the Wage Price Index.",
      );
    }),
  );

  it.effect("exits 4 with nothing on stdout when a table download fails", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        wagePriceIndexWith(TABLE_1_URL, { status: 404, body: "<html>Page not found</html>" }),
      );

      const result = yield* runCli(["abs", "get", "--catalogue", "6345.0"], http.layer);

      expect(result.exitCode).toBe(4);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("404");
      expect(result.stderr).toContain("Check your network connection");
    }),
  );

  it.effect("exits 1 when a table does not have the time series layout", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        wagePriceIndexWith(TABLE_1_URL, {
          status: 200,
          body: new TextEncoder().encode("<html><body>Not a spreadsheet</body></html>"),
        }),
      );

      const result = yield* runCli(["abs", "get", "--catalogue", "6345.0"], http.layer);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Table 634501 does not have the ABS time series layout");
      expect(result.stderr).toContain("github.com/jackemcpherson/ausecon/issues");
    }),
  );
});
