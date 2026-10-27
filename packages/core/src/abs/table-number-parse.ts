import type { TableNumber } from "../types";

// The prefix word is part of the match. A table number names a table, so an
// `APPENDIX` title names no table number, and `APPENDIX 2` never matches `2`.
const TITLE_PREFIX = /^(?:Tables|Table|TABLE|Data cube)[ _]/;

const NUMBER = String.raw`[A-Za-z]?\d+[A-Za-z]?(?:_[A-Za-z0-9]+)?`;

// `4, 5 and 6`, `4, 5, 6`, or `7 and 9`, ending where a single number would end.
const NUMBER_LIST = new RegExp(String.raw`^${NUMBER}(?:(?:,? and |, )${NUMBER})+(?=[.: ]|$)`);

const LIST_SEPARATOR = /,? and |, /;

// `01 to 17` or `2a to 9a`, ending where a single number would end.
const NUMBER_RANGE = /^([A-Za-z]?)(\d+)([A-Za-z]?) to ([A-Za-z]?)(\d+)([A-Za-z]?)(?=[.: ]|$)/;

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

// A comparable table number with no underscore suffix, split into its parts.
const NUMBER_PARTS = /^([A-Z]?)(\d+)([A-Z]?)$/;

/**
 * Test whether a range names a table number. A range whose ends carry the
 * same letters, such as `01 to 17` or `2a to 9a`, names each number from one
 * end to the other. A range whose letters differ, such as `2a to 4b`, names
 * only its two ends, as ADR 0005 records.
 *
 * The test compares numbers rather than listing the range, so a title with a
 * huge range costs no memory.
 */
const rangeMatch = (range: RegExpExecArray): TitleMatch => {
  const [
    ,
    firstPrefix = "",
    firstDigits = "",
    firstSuffix = "",
    lastPrefix = "",
    lastDigits = "",
    lastSuffix = "",
  ] = range;

  const prefix = firstPrefix.toUpperCase();
  const suffix = firstSuffix.toUpperCase();

  if (prefix !== lastPrefix.toUpperCase() || suffix !== lastSuffix.toUpperCase()) {
    return oneOf([
      `${firstPrefix}${firstDigits}${firstSuffix}`,
      `${lastPrefix}${lastDigits}${lastSuffix}`,
    ]);
  }

  const first = Number(firstDigits);
  const last = Number(lastDigits);

  return (tableNumber) => {
    const [, numberPrefix, digits = "", numberSuffix] = NUMBER_PARTS.exec(tableNumber) ?? [];
    const number = Number(digits);

    return numberPrefix === prefix && numberSuffix === suffix && number >= first && number <= last;
  };
};

/** Parse the table numbers a title names into a test. */
const titleMatch = (title: string): TitleMatch => {
  const prefix = TITLE_PREFIX.exec(title);

  if (prefix === null) {
    return NOTHING;
  }

  const rest = title.slice(prefix[0].length);
  const range = NUMBER_RANGE.exec(rest);

  if (range !== null) {
    return rangeMatch(range);
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
