import type { TableNumber } from "../types";

// The prefix word is part of the match. A table number names a table, so an
// `APPENDIX` title names no table number, and `APPENDIX 2` never matches `2`.
const TITLE_PREFIX = /^(?:Tables|Table|TABLE|Data cube)[ _]/;

const NUMBER = String.raw`[A-Za-z]?\d+[A-Za-z]?(?:_[A-Za-z0-9]+)?`;

// `4, 5 and 6`, `4, 5, 6`, or `7 and 9`, ending where a single number would end.
const NUMBER_LIST = new RegExp(String.raw`^${NUMBER}(?:(?:,? and |, )${NUMBER})+(?=[.: ]|$)`);

const LIST_SEPARATOR = /,? and |, /;

// `01 to 17`, ending where a single number would end.
const NUMBER_RANGE = /^(\d+) to (\d+)(?=[.: ]|$)/;

const DIGITS = /^\d+$/;

// A number runs to `.`, `:`, a space, or the end of the title.
const NUMBER_END = /[.: ]|$/;

/** A table number in upper case without leading zeros, for comparison. */
const comparable = (tableNumber: string): string =>
  tableNumber.toUpperCase().replace(/^([A-Z]?)0+(?=\d)/, "$1");

/** A test of whether a title names a comparable table number. */
type TitleMatch = (tableNumber: string) => boolean;

const NOTHING: TitleMatch = () => false;

const oneOf =
  (numbers: ReadonlyArray<string>): TitleMatch =>
  (tableNumber) =>
    numbers.map(comparable).includes(tableNumber);

/** Parse the table numbers a title names into a test. */
const titleMatch = (title: string): TitleMatch => {
  const prefix = TITLE_PREFIX.exec(title);

  if (prefix === null) {
    return NOTHING;
  }

  const rest = title.slice(prefix[0].length);
  const range = NUMBER_RANGE.exec(rest);

  if (range !== null) {
    const first = Number(range[1]);
    const last = Number(range[2]);

    return (tableNumber) =>
      DIGITS.test(tableNumber) && Number(tableNumber) >= first && Number(tableNumber) <= last;
  }

  const list = NUMBER_LIST.exec(rest);

  if (list !== null) {
    return oneOf(list[0].split(LIST_SEPARATOR));
  }

  const end = rest.search(NUMBER_END);
  const number = rest.slice(0, end);

  // An underscore suffix is part of the number only before `.` or `:`.
  return oneOf([/[.:]/.test(rest.charAt(end)) ? number : number.replace(/_.*$/, "")]);
};

/**
 * Test whether a table title names a table number.
 *
 * @param title - The `TableTitle` of a table.
 * @param tableNumber - The requested table number.
 * @returns Whether the title names the table number.
 */
export const titleNamesTable = (title: string, tableNumber: TableNumber): boolean =>
  titleMatch(title)(comparable(tableNumber));
