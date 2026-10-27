import { readFileSync } from "node:fs";

import { describe, expect, it } from "@effect/vitest";
import { read, utils } from "xlsx";

const fixture = readFileSync(new URL("fixtures/634501.xlsx", import.meta.url));

describe("ABS time series workbook layout", () => {
  it("keeps the series ID label in the tenth row of each data sheet", () => {
    const workbook = read(fixture, { type: "buffer" });
    const sheet = workbook.Sheets["Data1"];

    const rows =
      sheet === undefined ? [] : utils.sheet_to_json<ReadonlyArray<string>>(sheet, { header: 1 });

    expect(rows[9]?.[0]).toBe("Series ID");
  });
});
