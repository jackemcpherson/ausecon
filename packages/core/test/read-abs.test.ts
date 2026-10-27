import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { AbsRequest, CatalogueNotFound, CatalogueNumber, readAbs } from "../src/index";
import { directoryUrl, fixtureBytes, fixtureHttpClient, recorded } from "./fixture-http-client";

const readCatalogueWithDirectoryBody = (body: string) => {
  const http = fixtureHttpClient(
    new Map([[directoryUrl({ catno: "6345.0" }), { status: 200, body }]]),
  );

  return readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
    Effect.flip,
    Effect.provide(http.layer),
  );
};

describe("readAbs request input", () => {
  const invalidRequests: ReadonlyArray<readonly [string, AbsRequest]> = [
    ["a malformed catalogue number", AbsRequest.Catalogue({ catalogueNumber: "63-45" })],
    [
      "a malformed table number",
      AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: ["Table 1"] }),
    ],
    ["a malformed series ID", AbsRequest.Series({ seriesIds: ["A26-03039T"] })],
    ["an empty list of series IDs", AbsRequest.Series({ seriesIds: [] })],
  ];

  for (const [name, request] of invalidRequests) {
    it.effect(`fails with InvalidRequest for ${name}, before any request`, () =>
      Effect.gen(function* () {
        const http = fixtureHttpClient(new Map());

        const error = yield* readAbs(request).pipe(Effect.flip, Effect.provide(http.layer));

        expect(error._tag).toBe("InvalidRequest");
        expect(http.requests).toEqual([]);
      }),
    );
  }
});

describe("readAbs Time Series Directory lookup", () => {
  it.effect("appends .0 to a four-digit catalogue number", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[directoryUrl({ catno: "9999.0" }), recorded("tsd-catno-9999.0.xml")]]),
      );

      const error = yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "9999" })).pipe(
        Effect.flip,
        Effect.provide(http.layer),
      );

      expect(error).toEqual(
        new CatalogueNotFound({ catalogueNumber: Schema.decodeSync(CatalogueNumber)("9999.0") }),
      );
      expect(http.requests.map((request) => request.url)).toEqual([
        "https://abs.gov.au/servlet/TSSearchServlet?catno=9999.0",
      ]);
    }),
  );

  it.effect("sends the project User-Agent to the Time Series Directory", () =>
    Effect.gen(function* () {
      const http = fixtureHttpClient(
        new Map([[directoryUrl({ catno: "9999.0" }), recorded("tsd-catno-9999.0.xml")]]),
      );

      yield* readAbs(AbsRequest.Catalogue({ catalogueNumber: "9999.0" })).pipe(
        Effect.ignore,
        Effect.provide(http.layer),
      );

      expect(http.requests[0]?.userAgent).toMatch(
        /^ausecon .*github\.com\/jackemcpherson\/ausecon/,
      );
    }),
  );

  it.effect("fails with CatalogueNotFound for an index that lists no series", () =>
    Effect.gen(function* () {
      const error = yield* readCatalogueWithDirectoryBody(
        "<TimeSeriesIndex><SeriesCount>0</SeriesCount></TimeSeriesIndex>",
      );

      expect(error._tag).toBe("CatalogueNotFound");
    }),
  );

  const undecodableBodies: ReadonlyArray<readonly [string, string, string]> = [
    [
      "an error document",
      new TextDecoder().decode(fixtureBytes("tsd-error-invalid-query.xml")),
      "Invalid query.",
    ],
    ["malformed XML", "<TimeSeriesIndex><Series>", "malformed"],
    [
      "a series without its fields",
      "<TimeSeriesIndex><Series><SeriesID>A1A</SeriesID></Series></TimeSeriesIndex>",
      "Unexpected layout",
    ],
    ["a document without an index", "<Maintenance>Back soon</Maintenance>", "No TimeSeriesIndex"],
  ];

  for (const [name, body, message] of undecodableBodies) {
    it.effect(`fails with an HttpClientError decode error for ${name}`, () =>
      Effect.gen(function* () {
        const error = yield* readCatalogueWithDirectoryBody(body);

        expect(error._tag).toBe("HttpClientError");
        expect(error).toHaveProperty("reason._tag", "DecodeError");
        expect(error.message).toContain(message);
      }),
    );
  }
});
