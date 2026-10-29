import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
  type SyntheticRbaSeries,
  type SyntheticRows,
  fixtureHttpClient,
  rbaDataSheet,
  rbaTableUrl,
  syntheticTable,
} from "@ausecon/testkit";

import {
  RbaRequest,
  RbaSeriesNotFound,
  RbaTableLayoutError,
  RbaTableNumber,
  readRba,
} from "../src/index";

// Each test serves a synthetic table at the D9 table URL from the series index.
const TABLE_URL = rbaTableUrl("D9");

const RATE: SyntheticRbaSeries = {
  title: "Synthetic rate ",
  description: "Synthetic rate; monthly average",
  frequency: "Monthly",
  seriesType: "Original",
  unit: "Per cent",
  source: "RBA",
  publicationDate: "01-Oct-2026",
  seriesId: "ZSYNRATE",
};

const COUNT: SyntheticRbaSeries = {
  ...RATE,
  title: "Synthetic count",
  unit: "Number",
  source: "ABS / RBA",
  publicationDate: 46295,
  seriesId: "ZSYNCOUNT1",
};

const readSynthetic = (bytes: Uint8Array<ArrayBuffer>) => {
  const http = fixtureHttpClient(new Map([[TABLE_URL, { status: 200, body: bytes }]]));

  return readRba(RbaRequest.Table({ tableNumbers: ["D9"] })).pipe(Effect.provide(http.layer));
};

const readDataSheet = (rows: SyntheticRows) =>
  readSynthetic(syntheticTable([["Data", rows]])).pipe(Effect.flip);

describe("readRba on a synthetic statistical table", () => {
  it.effect("reads serial and text dates, skips blank rows, and drops blank or text values", () =>
    Effect.gen(function* () {
      const series = yield* readSynthetic(
        syntheticTable([
          ["Notes", [["Notes"], ["See notes"]]],
          [
            "Data",
            rbaDataSheet(
              [RATE, COUNT],
              [
                [46022, 4.35, 10],
                ["31-Jan-2026", 4.35, "N/A"],
                [null, null, null],
                ["28/02/2026", "", 12],
                [" 31/3/2026 ", 4.1, null],
              ],
            ),
          ],
        ]),
      );

      expect(series).toEqual([
        {
          publisher: "RBA",
          seriesId: "ZSYNRATE",
          title: "Synthetic rate",
          description: "Synthetic rate; monthly average",
          unit: "Per cent",
          seriesType: "Original",
          frequency: "Monthly",
          source: "RBA",
          publicationDate: "2026-10-01",
          table: { tableNumber: "D9", tableTitle: "Rural Debt by Lender" },
          observations: [
            { date: "2025-12-31", value: 4.35 },
            { date: "2026-01-31", value: 4.35 },
            { date: "2026-03-31", value: 4.1 },
          ],
        },
        {
          publisher: "RBA",
          seriesId: "ZSYNCOUNT1",
          title: "Synthetic count",
          description: "Synthetic rate; monthly average",
          unit: "Number",
          seriesType: "Original",
          frequency: "Monthly",
          source: "ABS / RBA",
          publicationDate: "2026-09-30",
          table: { tableNumber: "D9", tableTitle: "Rural Debt by Lender" },
          observations: [
            { date: "2025-12-31", value: 10 },
            { date: "2026-02-28", value: 12 },
          ],
        },
      ]);
    }),
  );

  it.effect("finds the label rows by text, wherever they sit above Series ID", () =>
    Effect.gen(function* () {
      const [header, ...rest] = rbaDataSheet([RATE], [[46022, 4.35]]);

      // Two blank rows move down from between Units and Source to above Title.
      const series = yield* readSynthetic(
        syntheticTable([["Data", [header ?? [], [], [], ...rest.filter((row) => row.length > 0)]]]),
      );

      expect(series.map(({ unit, source, observations }) => [unit, source, observations])).toEqual([
        ["Per cent", "RBA", [{ date: "2025-12-31", value: 4.35 }]],
      ]);
    }),
  );

  it.effect("keeps the first row of a repeated label", () =>
    Effect.gen(function* () {
      const [header, ...rest] = rbaDataSheet([RATE], [[46022, 4.35]]);

      const series = yield* readSynthetic(
        syntheticTable([
          ["Data", [header ?? [], ...rest.slice(0, 5), ["Units", "Later"], ...rest.slice(5)]],
        ]),
      );

      expect(series.map(({ unit }) => unit)).toEqual(["Per cent"]);
    }),
  );

  it.effect("reads every sheet with a series ID row, in sheet order, and skips the rest", () =>
    Effect.gen(function* () {
      const series = yield* readSynthetic(
        syntheticTable([
          ["Summary", rbaDataSheet([RATE], [[46022, 4.35]])],
          [
            "Use of Expert Judgement",
            [
              ["Date", "Note"],
              [46022, "None"],
            ],
          ],
          ["Developed countries", rbaDataSheet([COUNT], [[46022, 10]])],
          ["Notes", [["Notes"], ["See notes"]]],
        ]),
      );

      expect(series.map(({ seriesId, observations }) => [seriesId, observations])).toEqual([
        ["ZSYNRATE", [{ date: "2025-12-31", value: 4.35 }]],
        ["ZSYNCOUNT1", [{ date: "2025-12-31", value: 10 }]],
      ]);
    }),
  );

  it.effect("reads a Mnemonic row as the series ID row", () =>
    Effect.gen(function* () {
      const rows = rbaDataSheet([RATE], [[46022, 4.35]]).map((row) =>
        row[0] === "Series ID" ? ["Mnemonic", ...row.slice(1)] : row,
      );

      const series = yield* readSynthetic(syntheticTable([["Data", rows]]));

      expect(series.map(({ seriesId, publicationDate }) => [seriesId, publicationDate])).toEqual([
        ["ZSYNRATE", "2026-10-01"],
      ]);
    }),
  );

  it.effect("leaves out the publication date when the sheet has no Publication date row", () =>
    Effect.gen(function* () {
      const rows = rbaDataSheet([RATE], [[46022, 4.35]]).filter(
        (row) => row[0] !== "Publication date",
      );

      const [series] = yield* readSynthetic(syntheticTable([["Data", rows]]));

      expect(series).toMatchObject({ seriesId: "ZSYNRATE", source: "RBA" });
      expect(series).not.toHaveProperty("publicationDate");
    }),
  );
});

describe("readRba on a synthetic table without the RBA layout", () => {
  it.effect("fails with RbaTableLayoutError when the table is a broken spreadsheet", () =>
    Effect.gen(function* () {
      const error = yield* readSynthetic(new TextEncoder().encode("PK\u0003\u0004 truncated")).pipe(
        Effect.flip,
      );

      expect(error._tag).toBe("RbaTableLayoutError");
      expect(error).toMatchObject({ tableNumber: "D9", url: TABLE_URL });
      expect(error).toHaveProperty(
        "reason",
        expect.stringMatching(/^The table cannot be opened as a spreadsheet: \S/),
      );
    }),
  );

  it.effect("fails with RbaTableLayoutError when no sheet has a series ID row", () =>
    Effect.gen(function* () {
      const error = yield* readSynthetic(
        syntheticTable([
          ["2018", [["E3 DISTRIBUTION"], ["Size", "Share"], [100, 0.5]]],
          ["Notes", [["Notes"]]],
        ]),
      ).pipe(Effect.flip);

      expect(error._tag).toBe("RbaTableLayoutError");
      expect(error).toHaveProperty(
        "reason",
        "No sheet has a `Series ID` or `Mnemonic` row in column A.",
      );
    }),
  );

  it.effect("names the sheet whose layout fails", () =>
    Effect.gen(function* () {
      const error = yield* readSynthetic(
        syntheticTable([
          ["Summary", rbaDataSheet([RATE], [[46022, 4.35]])],
          ["Offshore centres", rbaDataSheet([{ ...COUNT, seriesId: "Total" }], [[46022, 10]])],
        ]),
      ).pipe(Effect.flip);

      expect(error).toHaveProperty(
        "reason",
        "Sheet `Offshore centres`: Cell B11 holds `Total`, which is not a series ID.",
      );
    }),
  );

  const layoutFailures: ReadonlyArray<readonly [string, SyntheticRows, string]> = [
    [
      "label rows are missing",
      rbaDataSheet([RATE], [[46022, 4.35]]).filter(
        (row) => row[0] !== "Title" && row[0] !== "Type",
      ),
      "Sheet `Data`: Column A above `Series ID` lacks the rows: `Title`, `Type`.",
    ],
    [
      "the Series ID row holds text that is not a series ID",
      rbaDataSheet([RATE, { ...RATE, seriesId: "Total" }], [[46022, 4.35, 1]]),
      "Sheet `Data`: Cell C11 holds `Total`, which is not a series ID.",
    ],
    [
      "column A holds text that is not a date",
      rbaDataSheet(
        [RATE],
        [
          [46022, 4.35],
          ["Total", 9],
        ],
      ),
      "Sheet `Data`: Cell A13 holds `Total`, which is not a date or a blank.",
    ],
    [
      "column A holds a text date that is not on the calendar",
      rbaDataSheet([RATE], [["31/02/2026", 4.35]]),
      "Sheet `Data`: Cell A12 holds `31/02/2026`, which is not a date or a blank.",
    ],
    [
      "column A holds a text date with an unknown month",
      rbaDataSheet([RATE], [["01-Spt-2026", 4.35]]),
      "Sheet `Data`: Cell A12 holds `01-Spt-2026`, which is not a date or a blank.",
    ],
    [
      "a publication date is not a date",
      rbaDataSheet([{ ...RATE, publicationDate: "Oct-2026" }], [[46022, 4.35]]),
      "Sheet `Data`: Cell B10 holds `Oct-2026`, which is not a publication date.",
    ],
  ];

  for (const [name, rows, reason] of layoutFailures) {
    it.effect(`fails with RbaTableLayoutError when ${name}`, () =>
      Effect.gen(function* () {
        const error = yield* readDataSheet(rows);

        expect(error).toEqual(
          new RbaTableLayoutError({
            tableNumber: Schema.decodeSync(RbaTableNumber)("D9"),
            url: TABLE_URL,
            reason,
          }),
        );
      }),
    );
  }
});

describe("readRba series IDs on a synthetic statistical table", () => {
  it.effect("fails with RbaSeriesNotFound when the indexed table does not hold the series", () =>
    Effect.gen(function* () {
      const table = syntheticTable([["Data", rbaDataSheet([RATE], [[46022, 4.35]])]]);
      const http = fixtureHttpClient(new Map([[TABLE_URL, { status: 200, body: table }]]));

      // The series index lists DRDAB and DRDT in D9; this D9 holds neither.
      const error = yield* readRba(RbaRequest.Series({ seriesIds: ["DRDAB", "drdt"] })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error).toBeInstanceOf(RbaSeriesNotFound);
      expect(error).toHaveProperty("seriesIds", ["DRDAB", "DRDT"]);
      expect(error.message).toContain("The series index may be out of date");
      expect(http.requests.map(({ url }) => url)).toEqual([TABLE_URL]);
    }),
  );
});
