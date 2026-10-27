import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { fixtureBytes, absDataSheet, syntheticTable } from "@ausecon/testkit";

import { TableId, TableLayoutError, parseTable } from "../src/index";

const TABLE_634501 = { tableId: Schema.decodeSync(TableId)("634501") };

describe("parseTable", () => {
  it.effect("reads the series of a recorded table without a title", () =>
    Effect.gen(function* () {
      const series = yield* parseTable(fixtureBytes("634501.xlsx"), TABLE_634501);

      expect(series[0]).toMatchObject({
        seriesId: "A2603039T",
        unit: "Index Numbers",
        seriesType: "Original",
        dataType: "INDEX",
        frequency: "Quarter",
        collectionMonth: "3",
        table: { tableId: "634501" },
        sheet: "Data1",
      });
      expect(series[0]?.observations[0]).toEqual({ date: "1997-09-01", value: 67.4 });
      expect(series.every(({ table }) => !("tableTitle" in table))).toBe(true);
    }),
  );

  it.effect("puts a supplied title on each series", () =>
    Effect.gen(function* () {
      const table = { ...TABLE_634501, tableTitle: "Table 1. Wages" };

      const series = yield* parseTable(fixtureBytes("634501.xlsx"), table);

      expect(new Set(series.map((each) => each.table))).toEqual(new Set([table]));
    }),
  );

  it.effect("fails with TableLayoutError naming the table ID and sheet", () =>
    Effect.gen(function* () {
      const rows = absDataSheet([], [[46023]]).map((row, index) =>
        index === 9 ? ["Series Code"] : row,
      );

      const error = yield* parseTable(syntheticTable([["Data1", rows]]), TABLE_634501).pipe(
        Effect.flip,
      );

      expect(error).toEqual(
        new TableLayoutError({
          tableId: TABLE_634501.tableId,
          sheet: "Data1",
          reason: "Column A of row 10 is not `Series ID`.",
        }),
      );
    }),
  );
});
