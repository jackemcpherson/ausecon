import { TableId } from "../types";
import type { DirectoryRow } from "./time-series-directory-parse";

/** One table of a release, as the Time Series Directory lists it. */
export interface DirectoryTable {
  readonly tableId: TableId;
  readonly tableTitle: string;
  readonly tableUrl: string;
}

/**
 * Keep only rows that link to a table, from the latest release of each table.
 *
 * A table is one `TableURL`, as `readabs` groups it in `read_abs`. Rows with an
 * empty `TableURL` link to no table.
 *
 * @param rows - Directory rows.
 * @returns The rows with a `TableURL` whose release date is the latest for
 * their table.
 */
export const latestRows = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryRow> => {
  const linked = rows.filter((row) => row.tableUrl.trim() !== "");

  const latestDates = new Map(
    [...Map.groupBy(linked, (row) => row.tableUrl)].map(([tableUrl, group]) => [
      tableUrl,
      group.reduce((latest, row) => (row.releaseDate > latest ? row.releaseDate : latest), ""),
    ]),
  );

  return linked.filter((row) => latestDates.get(row.tableUrl) === row.releaseDate);
};

/** The file name of a table URL without its extension. */
const tableIdOf = (tableUrl: string): TableId =>
  TableId.make(
    tableUrl
      .replace(/[?#].*$/, "")
      .replace(/^.*\//, "")
      .replace(/\.[^.]*$/, ""),
  );

/**
 * List the distinct tables of directory rows, in row order.
 *
 * @param rows - Directory rows, already filtered to the latest release.
 * @returns One entry per `TableURL`, titled by its first row.
 */
export const tablesOf = (rows: ReadonlyArray<DirectoryRow>): ReadonlyArray<DirectoryTable> =>
  [...Map.groupBy(rows, (row) => row.tableUrl).values()].flatMap(([first]) =>
    first === undefined
      ? []
      : [
          {
            tableId: tableIdOf(first.tableUrl),
            tableTitle: first.tableTitle,
            tableUrl: first.tableUrl,
          },
        ],
  );
