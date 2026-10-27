import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

// The title match is an internal seam that the spec keeps under unit test.
import { titleNamesTable } from "../src/abs/table-number-parse";
import { TableNumber } from "../src/index";

const names = (title: string, tableNumber: string): boolean =>
  titleNamesTable(title, Schema.decodeSync(TableNumber)(tableNumber));

describe("titleNamesTable", () => {
  it("matches a single table number before a full stop", () => {
    expect(names("Table 1. Total Hourly Rates of Pay Excluding Bonuses", "1")).toBe(true);
    expect(names("Table 1. Total Hourly Rates of Pay Excluding Bonuses", "2")).toBe(false);
  });

  it("ignores leading zeros on either side", () => {
    expect(names("Table 001. Labour force status by Sex", "1")).toBe(true);
    expect(names("Table 1. Labour force status by Sex", "001")).toBe(true);
  });

  it("ignores the case of a letter suffix", () => {
    expect(names("Table 5a. Ordinary Hourly Rates of Pay", "5A")).toBe(true);
    expect(names("Table 5a. Ordinary Hourly Rates of Pay", "5b")).toBe(false);
  });

  it("matches a letter prefix", () => {
    expect(names("TABLE X28: Persons Not in the Labour Force", "X28")).toBe(true);
    expect(names("TABLE X28: Persons Not in the Labour Force", "28")).toBe(false);
  });

  it("keeps an underscore suffix before a colon", () => {
    expect(names("Table 021_MTH: Employed persons by Industry", "021_MTH")).toBe(true);
    expect(names("Table 021_MTH: Employed persons by Industry", "21")).toBe(false);
  });

  it("drops an underscore suffix before a space", () => {
    expect(names("Data cube 6_Sex Employed persons", "6")).toBe(true);
  });

  it("matches a number that ends the title", () => {
    expect(names("Table 3", "3")).toBe(true);
  });

  it("matches each number in a list", () => {
    for (const title of ["Tables 4, 5 and 6. Indexes", "Tables 4, 5, 6. Indexes"]) {
      expect(names(title, "4")).toBe(true);
      expect(names(title, "5")).toBe(true);
      expect(names(title, "6")).toBe(true);
      expect(names(title, "7")).toBe(false);
    }
  });

  it("matches each number in a range whose ends carry the same letters", () => {
    expect(names("Tables 01 to 17. Labour force", "9")).toBe(true);
    expect(names("Tables 01 to 17. Labour force", "18")).toBe(false);
    expect(names("Tables 2a to 9a. Wage Price Index", "5a")).toBe(true);
    expect(names("Tables 2a to 9a. Wage Price Index", "5b")).toBe(false);
    expect(names("Tables 2a to 9a. Wage Price Index", "5")).toBe(false);
  });

  it("matches only the ends of a range whose ends carry different letters", () => {
    expect(names("Tables 2a to 4b. Wage Price Index", "2a")).toBe(true);
    expect(names("Tables 2a to 4b. Wage Price Index", "4b")).toBe(true);
    expect(names("Tables 2a to 4b. Wage Price Index", "3a")).toBe(false);
  });

  it("matches no table number in a title without a table prefix", () => {
    expect(names("APPENDIX 2. Standard errors", "2")).toBe(false);
    expect(names("Total Hourly Rates of Pay", "1")).toBe(false);
  });
});
