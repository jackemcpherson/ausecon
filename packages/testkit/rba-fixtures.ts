import { type RecordedResponse, recorded } from "./fixture-http-client";

/** The folder of current statistical table spreadsheets on the RBA site. */
export const RBA_TABLES = "https://www.rba.gov.au/statistics/tables/xls/";

/**
 * The recorded statistical tables by RBA table number, as files in
 * `fixtures/`. They were downloaded from the RBA tables page on 29 October
 * 2026. F1.1 also has a Frequency of `See notes`.
 */
export const RBA_TABLE_FILES = {
  D9: "d09hist.xls",
  F1: "f01d.xlsx",
  "F1.1": "f01hist.xlsx",
} as const;

/**
 * Build the table URL of a recorded statistical table, as the series index
 * lists it.
 *
 * @param tableNumber - The RBA table number of a recorded table.
 * @returns The table URL.
 */
export const rbaTableUrl = (tableNumber: keyof typeof RBA_TABLE_FILES): string =>
  `${RBA_TABLES}${RBA_TABLE_FILES[tableNumber]}`;

/**
 * Responses for every recorded statistical table, keyed by table URL.
 *
 * @returns The responses keyed by request URL.
 */
export const rbaTableResponses = (): ReadonlyMap<string, RecordedResponse> =>
  new Map(
    Object.values(RBA_TABLE_FILES).map((file): [string, RecordedResponse] => [
      `${RBA_TABLES}${file}`,
      recorded(file),
    ]),
  );
