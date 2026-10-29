import { Effect, Schema } from "effect";
import { parse } from "node-html-parser";

import { RbaTableNumber } from "../core/src/types";
import { IndexBuildError } from "./types";

/** The RBA page that lists every current statistical table. */
export const TABLES_PAGE = "https://www.rba.gov.au/statistics/tables/";

/** The link of each table entry on the tables page. */
const TABLE_LINKS = "#tables-list li > div.title > a[href]";

/** A spreadsheet URL path. PDF and CSV links are skipped. */
const EXCEL_PATH = /\.xlsx?$/i;

/** The text between a table title and its RBA table number, as in `Rural Debt by Lender – D9`. */
const NUMBER_SEPARATOR = " – ";

/** One statistical table that the tables page links to as a spreadsheet. */
export interface TableLink {
  readonly tableNumber: RbaTableNumber;
  /** The link text without the trailing table number. */
  readonly title: string;
  /** The absolute spreadsheet URL. */
  readonly url: string;
}

/** Split link text such as `Interest Rates – Daily – F1` into its title and table number. */
const tableLink = (text: string, url: string): Effect.Effect<TableLink, IndexBuildError> => {
  const separator = text.lastIndexOf(NUMBER_SEPARATOR);
  const tableNumber = text.slice(separator + NUMBER_SEPARATOR.length);

  const failure = new IndexBuildError({
    url,
    reason: `The tables page links to the table as \`${text}\`, which does not end with an RBA table number.`,
  });

  return separator < 0
    ? Effect.fail(failure)
    : Schema.decodeUnknownEffect(RbaTableNumber)(tableNumber).pipe(
        Effect.mapError(() => failure),
        Effect.map((decoded) => ({ tableNumber: decoded, title: text.slice(0, separator), url })),
      );
};

/**
 * Read the spreadsheet links from the RBA tables page.
 *
 * Keeps each `.xlsx` and `.xls` link of a table entry, in page order. Link
 * text has its entities decoded and its spaces collapsed, then splits at the
 * last ` – ` into the title and the RBA table number.
 *
 * @param html - The tables page.
 * @returns An Effect that yields the links. It fails with `IndexBuildError`
 * when a link has no RBA table number, two links share one, or the page
 * links to no spreadsheet.
 */
export const parseTablesPage = (
  html: string,
): Effect.Effect<ReadonlyArray<TableLink>, IndexBuildError> => {
  const spreadsheetLinks = parse(html)
    .querySelectorAll(TABLE_LINKS)
    .flatMap((anchor) => {
      const url = new URL(anchor.getAttribute("href") ?? "", TABLES_PAGE);
      const text = anchor.text.replaceAll(/\s+/g, " ").trim();

      return EXCEL_PATH.test(url.pathname) ? [[text, url.href] as const] : [];
    });

  return Effect.forEach(spreadsheetLinks, ([text, url]) => tableLink(text, url)).pipe(
    Effect.flatMap((links) => {
      const numbers = links.map(({ tableNumber }) => tableNumber);
      const repeated = numbers.find((number, index) => numbers.indexOf(number) !== index);

      if (links.length === 0) {
        return Effect.fail(
          new IndexBuildError({ url: TABLES_PAGE, reason: "The page links to no spreadsheet." }),
        );
      }

      return repeated === undefined
        ? Effect.succeed(links)
        : Effect.fail(
            new IndexBuildError({
              url: TABLES_PAGE,
              reason: `The page links to two spreadsheets for table ${repeated}.`,
            }),
          );
    }),
  );
};
