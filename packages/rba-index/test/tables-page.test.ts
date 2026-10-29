import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { TABLES_PAGE, parseTablesPage } from "../tables-page";
import { IndexBuildError } from "../types";

const page = (...links: ReadonlyArray<string>): string =>
  `<div id="tables-list"><ul>${links
    .map((link) => `<li><div class="title searchable">${link}</div></li>`)
    .join("")}</ul></div>`;

describe("parseTablesPage", () => {
  it.effect("keeps spreadsheet links, decodes entities, and collapses spaces", () =>
    Effect.gen(function* () {
      const links = yield* parseTablesPage(
        `<a href="/other.xlsx">Outside the list &ndash; Z9</a>${page(
          '<a href="/statistics/tables/xls/a01.XLSX">RBA Balance Sheet &ndash; A1</a>',
          '<a href="/statistics/tables/pdf/f03.pdf">Bonds &ndash; F3</a>',
          '<a href="/statistics/tables/xls/b13-1-2-hist.xlsx">Consolidated Exposures\n\t\t&ndash; Immediate Risk Basis &ndash; B13.1.2</a>',
        )}`,
      );

      expect(links).toEqual([
        {
          tableNumber: "A1",
          title: "RBA Balance Sheet",
          url: `${TABLES_PAGE}xls/a01.XLSX`,
        },
        {
          tableNumber: "B13.1.2",
          title: "Consolidated Exposures – Immediate Risk Basis",
          url: `${TABLES_PAGE}xls/b13-1-2-hist.xlsx`,
        },
      ]);
    }),
  );

  const failures: ReadonlyArray<readonly [string, string, IndexBuildError]> = [
    [
      "a link has no table number",
      page('<a href="/statistics/tables/xls/a01.xlsx">RBA Balance Sheet</a>'),
      new IndexBuildError({
        url: `${TABLES_PAGE}xls/a01.xlsx`,
        reason:
          "The tables page links to the table as `RBA Balance Sheet`, which does not end with an RBA table number.",
      }),
    ],
    [
      "a link ends with text that is not a table number",
      page('<a href="/statistics/tables/xls/a01.xlsx">RBA Balance Sheet &ndash; Current</a>'),
      new IndexBuildError({
        url: `${TABLES_PAGE}xls/a01.xlsx`,
        reason:
          "The tables page links to the table as `RBA Balance Sheet – Current`, which does not end with an RBA table number.",
      }),
    ],
    [
      "two links share a table number",
      page(
        '<a href="/statistics/tables/xls/a01.xlsx">RBA Balance Sheet &ndash; A1</a>',
        '<a href="/statistics/tables/xls/a01hist.xlsx">RBA Balance Sheet &ndash; A1</a>',
      ),
      new IndexBuildError({
        url: TABLES_PAGE,
        reason: "The page links to two spreadsheets for table A1.",
      }),
    ],
    [
      "the page links to no spreadsheet",
      "<html><body>Maintenance</body></html>",
      new IndexBuildError({ url: TABLES_PAGE, reason: "The page links to no spreadsheet." }),
    ],
  ];

  for (const [name, html, expected] of failures) {
    it.effect(`fails with IndexBuildError when ${name}`, () =>
      Effect.gen(function* () {
        const error = yield* parseTablesPage(html).pipe(Effect.flip);

        expect(error).toEqual(expected);
      }),
    );
  }
});
