import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { fixtureBytes } from "@ausecon/testkit";

// The page parser is an internal seam that the spec keeps under unit test.
import { parseDirectoryPage } from "../src/abs/time-series-directory-parse";

const recordedPage = (file: string): string => new TextDecoder().decode(fixtureBytes(file));

const seriesElement = (fields: {
  readonly releaseDate?: string;
  readonly tableOrder?: string;
}): string =>
  "<Series>" +
  `<ProductReleaseDate>${fields.releaseDate ?? "19/08/2026"}</ProductReleaseDate>` +
  "<TableURL>https://www.abs.gov.au/statistics/634501.xlsx</TableURL>" +
  "<TableTitle>Table 1. Total Hourly Rates of Pay Excluding Bonuses</TableTitle>" +
  `<TableOrder>${fields.tableOrder ?? "7"}</TableOrder>` +
  "<SeriesID>A2603039T</SeriesID>" +
  "</Series>";

const index = (body: string): string =>
  `<?xml version="1.0" encoding="utf-8" ?><TimeSeriesIndex>${body}</TimeSeriesIndex>`;

describe("parseDirectoryPage", () => {
  it.effect("reads the page count and every row of a recorded page", () =>
    Effect.gen(function* () {
      const page = yield* parseDirectoryPage(recordedPage("directory-6345.0-p2.xml"));

      expect(page.pageCount).toBe(10);
      expect(page.rows).toHaveLength(100);
      expect(page.rows[0]).toEqual({
        releaseDate: "2026-08-19",
        tableUrl:
          "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release/634503b.xlsx",
        tableTitle:
          "Table 3b. Total Hourly Rates of Pay Excluding Bonuses: Private Sector by State, Original (Quarterly Index Numbers)",
        tableOrder: 62,
        seriesId: "A2608360C",
      });
    }),
  );

  it.effect("keeps a single Series element as a row", () =>
    Effect.gen(function* () {
      const page = yield* parseDirectoryPage(index(seriesElement({ tableOrder: "007" })));

      expect(page).toEqual({
        pageCount: 1,
        rows: [
          {
            releaseDate: "2026-08-19",
            tableUrl: "https://www.abs.gov.au/statistics/634501.xlsx",
            tableTitle: "Table 1. Total Hourly Rates of Pay Excluding Bonuses",
            tableOrder: 7,
            seriesId: "A2603039T",
          },
        ],
      });
    }),
  );

  it.effect("parses an empty index to one page with no rows", () =>
    Effect.gen(function* () {
      const page = yield* parseDirectoryPage(recordedPage("directory-catno-9999.0.xml"));

      expect(page).toEqual({ pageCount: 1, rows: [] });
    }),
  );

  it.effect("parses an index with a page count and no Series to no rows", () =>
    Effect.gen(function* () {
      const page = yield* parseDirectoryPage(index("<NumPages>3</NumPages>"));

      expect(page).toEqual({ pageCount: 3, rows: [] });
    }),
  );

  it.effect("fails with the Directory's message for an error document", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage(
        recordedPage("directory-error-invalid-query.xml"),
      ).pipe(Effect.flip);

      expect(error._tag).toBe("DirectoryDocumentError");
      expect(error.reason).toBe("The Time Series Directory answered: Invalid query.");
    }),
  );

  it.effect("fails for malformed XML", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage("<TimeSeriesIndex><Series>").pipe(Effect.flip);

      expect(error._tag).toBe("DirectoryDocumentError");
      expect(error.reason).toMatch(/^The XML is malformed: /);
    }),
  );

  it.effect("fails for a document without a TimeSeriesIndex element", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage("<html><body>Maintenance</body></html>").pipe(
        Effect.flip,
      );

      expect(error.reason).toBe("No TimeSeriesIndex element.");
    }),
  );

  it.effect("fails with an unexpected layout for a date that is not DD/MM/YYYY", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage(
        index(seriesElement({ releaseDate: "2026-08-19" })),
      ).pipe(Effect.flip);

      expect(error.reason).toMatch(/^Unexpected layout: /);
    }),
  );

  it.effect("fails with an unexpected layout for a table order that is not a number", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage(index(seriesElement({ tableOrder: "first" }))).pipe(
        Effect.flip,
      );

      expect(error.reason).toMatch(/^Unexpected layout: /);
    }),
  );

  it.effect("fails with an unexpected layout for a page count of zero", () =>
    Effect.gen(function* () {
      const error = yield* parseDirectoryPage(index("<NumPages>0</NumPages>")).pipe(Effect.flip);

      expect(error.reason).toMatch(/^Unexpected layout: /);
    }),
  );
});
