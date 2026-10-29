import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import { fixtureHttpClient, rbaTableResponses, rbaTableUrl } from "@ausecon/testkit";

import { RbaRequest, RbaTableNotFound, RbaUnavailable, readRba } from "../src/index";

const readTables = (tableNumbers: ReadonlyArray<string>) => {
  const http = fixtureHttpClient(rbaTableResponses());

  return readRba(RbaRequest.Table({ tableNumbers })).pipe(
    Effect.provide(http.layer),
    Effect.map((series) => ({ series, requests: http.requests })),
  );
};

describe("readRba on recorded statistical tables", () => {
  it.effect("reads the cash rate target from F1 with ISO dates and RBA metadata", () =>
    Effect.gen(function* () {
      const { series } = yield* readTables(["F1"]);
      const cashRateTarget = series.find(({ seriesId }) => seriesId === "FIRMMCRTD");

      expect(series).toHaveLength(17);
      expect(series[0]).toBe(cashRateTarget);

      // Checked by hand against f01d.xlsx: the Data sheet holds 4,006 dated
      // rows from serial 40547 (2011-01-04, 4.75 per cent) to serial 46324
      // (2026-10-29), whose FIRMMCRTD cell is blank text. The last value is
      // 4.6 on 2026-10-28. The publication date is serial 46324.
      expect(cashRateTarget).toMatchObject({
        publisher: "RBA",
        seriesId: "FIRMMCRTD",
        title: "Cash Rate Target",
        description: "Cash Rate Target on date",
        unit: "Per cent",
        seriesType: "Original",
        frequency: "Daily",
        source: "RBA",
        publicationDate: "2026-10-29",
        table: {
          tableNumber: "F1",
          tableTitle: "Interest Rates and Yields – Money Market – Daily",
        },
      });
      expect(cashRateTarget?.observations).toHaveLength(4005);
      expect(cashRateTarget?.observations[0]).toEqual({ date: "2011-01-04", value: 4.75 });
      expect(cashRateTarget?.observations.at(-1)).toEqual({ date: "2026-10-28", value: 4.6 });
    }),
  );

  it.effect("drops blank cells from the observations", () =>
    Effect.gen(function* () {
      const { series } = yield* readTables(["F1"]);
      const change = series.find(({ seriesId }) => seriesId === "FIRMMCCRT");

      // FIRMMCCRT holds a value only on the days the target changed.
      expect(change?.frequency).toBe("as announced");
      expect(change?.title).toBe("Change in the Cash Rate Target");
      expect(change?.observations.length).toBeGreaterThan(0);
      expect(change?.observations.length).toBeLessThan(100);
    }),
  );

  it.effect("finds F1.1 from a lower-case RBA table number and keeps `See notes`", () =>
    Effect.gen(function* () {
      const { series, requests } = yield* readTables(["f1.1"]);
      const treasuryNote = series.find(({ seriesId }) => seriesId === "FIRMMTN1");

      expect(requests.map(({ url }) => url)).toEqual([rbaTableUrl("F1.1")]);
      expect(series).toHaveLength(15);

      // Checked by hand against f01hist.xlsx: FIRMMTN1 has 139 values from
      // 1995-01-31 (7.5915), and the publication date is the text `01-Oct-2026`.
      expect(treasuryNote).toMatchObject({
        frequency: "See notes",
        publicationDate: "2026-10-01",
        table: {
          tableNumber: "F1.1",
          tableTitle: "Interest Rates and Yields – Money Market – Monthly",
        },
      });
      expect(treasuryNote?.observations).toHaveLength(139);
      expect(treasuryNote?.observations[0]).toEqual({ date: "1995-01-31", value: 7.5915 });
    }),
  );

  it.effect("reads the .xls table D9", () =>
    Effect.gen(function* () {
      const { series } = yield* readTables(["D9"]);
      const allBanks = series.find(({ seriesId }) => seriesId === "DRDAB");

      expect(series.map(({ seriesId }) => seriesId)).toEqual([
        "DRDAB",
        "DRDPOFC",
        "DRDOG",
        "DRDLIC",
        "DRDT",
      ]);

      // Checked by hand against d09hist.xls: 61 annual values from serial
      // 23923 (1965-06-30, 656) to 2025-06-30 (135358), sourced from APRA.
      expect(allBanks).toMatchObject({
        title: "Rural debt  by; All banks",
        unit: "$ million",
        frequency: "Annual",
        source: "APRA",
        publicationDate: "2025-11-28",
      });
      expect(allBanks?.observations).toHaveLength(61);
      expect(allBanks?.observations[0]).toEqual({ date: "1965-06-30", value: 656 });
      expect(allBanks?.observations.at(-1)).toEqual({ date: "2025-06-30", value: 135_358 });
    }),
  );

  it.effect("reads several tables in request order, downloading each once", () =>
    Effect.gen(function* () {
      const { series, requests } = yield* readTables(["F1.1", "D9", "f1.1"]);

      expect([...new Set(series.map(({ table }) => table.tableNumber))]).toEqual(["F1.1", "D9"]);
      expect(requests.map(({ url }) => url).toSorted()).toEqual(
        [rbaTableUrl("D9"), rbaTableUrl("F1.1")].toSorted(),
      );
      expect(requests.map(({ userAgent }) => userAgent)).toEqual([
        expect.stringMatching(/^ausecon .*github\.com\/jackemcpherson\/ausecon/),
        expect.stringMatching(/^ausecon .*github\.com\/jackemcpherson\/ausecon/),
      ]);
    }),
  );
});

describe("readRba failures", () => {
  const invalidRequests: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ["a malformed RBA table number", ["F1-1"]],
    ["an ABS table number", ["Table 1"]],
    ["an empty list of RBA table numbers", []],
  ];

  for (const [name, tableNumbers] of invalidRequests) {
    it.effect(`fails with InvalidRequest for ${name}, before any request`, () =>
      Effect.gen(function* () {
        const http = fixtureHttpClient(new Map());

        const error = yield* readRba(RbaRequest.Table({ tableNumbers })).pipe(
          Effect.flip,
          Effect.provide(http.layer),
        );

        expect(error._tag).toBe("InvalidRequest");
        expect(http.requests).toEqual([]);
      }),
    );
  }

  it.effect("fails with RbaTableNotFound naming every table the index lacks", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(rbaTableResponses());

      const error = yield* readRba(RbaRequest.Table({ tableNumbers: ["Z9", "F1", "z9.1"] })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error).toBeInstanceOf(RbaTableNotFound);
      expect(error).toHaveProperty("tableNumbers", ["Z9", "Z9.1"]);
      expect(error).not.toHaveProperty("url");
      expect(error.message).toBe(
        "No current RBA statistical table has the RBA table number Z9, Z9.1. The series index may be out of date: a newer ausecon release may find it.",
      );
      expect(http.requests).toEqual([]);
    }),
  );

  it.effect("fails with RbaTableNotFound when the table URL in the index answers 404", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[rbaTableUrl("F1"), { status: 404, body: "<html>Page not found</html>" }]]),
      );

      const error = yield* readRba(RbaRequest.Table({ tableNumbers: ["F1"] })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error._tag).toBe("RbaTableNotFound");
      expect(error).toMatchObject({ tableNumbers: ["F1"], url: rbaTableUrl("F1") });
      expect(error.message).toContain("The series index may be out of date");
    }),
  );

  it.effect("fails with RbaTableLayoutError for a table the index lists as unreadable", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(rbaTableResponses());

      const error = yield* readRba(RbaRequest.Table({ tableNumbers: ["F1", "e3"] })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error._tag).toBe("RbaTableLayoutError");
      expect(error).toMatchObject({
        tableNumber: "E3",
        url: "https://www.rba.gov.au/statistics/tables/xls/e03hist.xls",
      });
      expect(error).toHaveProperty(
        "reason",
        expect.stringMatching(/^The series index lists the table as unreadable: \S/),
      );
      expect(http.requests).toEqual([]);
    }),
  );

  it.effect("fails with RbaUnavailable and the status for any other status outside 2xx", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[rbaTableUrl("D9"), { status: 503, body: "Service unavailable" }]]),
      );

      const error = yield* readRba(RbaRequest.Table({ tableNumbers: ["D9"] })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error).toEqual(
        new RbaUnavailable({
          url: rbaTableUrl("D9"),
          status: 503,
          detail: "The RBA answered with status 503.",
        }),
      );
    }),
  );

  it.effect("fails with RbaUnavailable without a status when a request gets no response", () =>
    Effect.gen(function* () {
      const offline = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new TypeError("fetch failed", {
                  cause: new Error("getaddrinfo ENOTFOUND www.rba.gov.au"),
                }),
              }),
            }),
          ),
        ),
      );

      const error = yield* readRba(RbaRequest.Table({ tableNumbers: ["D9"] })).pipe(
        Effect.flip,
        Effect.provide(offline),
      );

      expect(error._tag).toBe("RbaUnavailable");
      expect(error).toHaveProperty("url", rbaTableUrl("D9"));
      expect(error).toHaveProperty("detail", "fetch failed: getaddrinfo ENOTFOUND www.rba.gov.au");
      expect(error).not.toHaveProperty("status");
    }),
  );
});
