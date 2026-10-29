import { SERIES_INDEX } from "./series-index-data";
import { findTable } from "./series-index";

/**
 * One series in the series index, joined to the title of the table that holds
 * it. Each entry carries its publisher, so that a later ABS index can join the
 * same search.
 */
export interface SeriesIndexEntry {
  readonly publisher: "RBA";
  readonly seriesId: string;
  readonly title: string;
  readonly description: string;
  readonly unit: string;
  readonly frequency: string;
  readonly seriesType: string;
  /** The RBA table number of the table that holds the series. */
  readonly tableNumber: string;
  /** The title of the table that holds the series. */
  readonly tableTitle: string;
}

/** Options for {@link searchSeries}. */
export interface SearchSeriesOptions {
  /** The most entries to return. Without it, every match is returned. */
  readonly limit?: number;
}

interface SearchableEntry {
  readonly entry: SeriesIndexEntry;
  /** The lower-case fields that a word can match. */
  readonly fields: ReadonlyArray<string>;
}

const searchableEntries: ReadonlyArray<SearchableEntry> = SERIES_INDEX.series.map((series) => {
  const entry: SeriesIndexEntry = {
    publisher: "RBA",
    seriesId: series.seriesId,
    title: series.title,
    description: series.description,
    unit: series.unit,
    frequency: series.frequency,
    seriesType: series.seriesType,
    tableNumber: series.tableNumber,
    tableTitle: findTable(series.tableNumber)?.title ?? "",
  };

  const fields = [entry.seriesId, entry.title, entry.description, entry.tableTitle].map((field) =>
    field.toLowerCase(),
  );

  return { entry, fields };
});

/**
 * Search the series index by words. Makes no request.
 *
 * An entry matches when every word appears, in any case, inside its series
 * ID, title, description, or table title. Each word must sit inside one field;
 * a word never spans two. Results keep index order: table order, then column
 * order. With no words, every entry matches.
 *
 * @param words - The words to match.
 * @param options - An optional `limit` on the number of entries returned.
 * @returns The matching index entries, in index order.
 *
 * @example
 * ```typescript
 * const [cashRateTarget] = searchSeries(["cash", "rate", "target"], { limit: 1 });
 * ```
 */
export const searchSeries = (
  words: ReadonlyArray<string>,
  options?: SearchSeriesOptions,
): ReadonlyArray<SeriesIndexEntry> => {
  const lowerWords = words.map((word) => word.toLowerCase());

  const matches = searchableEntries.flatMap(({ entry, fields }) =>
    lowerWords.every((word) => fields.some((field) => field.includes(word))) ? [entry] : [],
  );

  return options?.limit === undefined ? matches : matches.slice(0, Math.max(0, options.limit));
};
