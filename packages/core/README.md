# `@ausecon/core`

`@ausecon/core` is a TypeScript library that reads Australian economic data
from the Australian Bureau of Statistics (ABS) and the Reserve Bank of
Australia (RBA). It ports the `readabs` and `readrba` R packages and uses
[Effect](https://effect.website).

The library uses no Node, Bun, or Deno APIs. It runs on Node 22.18 or later,
Bun, and Deno.

---

## Install

```shell
npm install @ausecon/core effect
```

## Read ABS Time Series

`readAbs` reads ABS time series from the latest release. It reads every
table of a catalogue number, chosen tables by table number, or a list of
series IDs from any catalogue numbers.

`readAbs` returns an `Effect` that needs an `HttpClient`. To run it without
writing Effect code, provide Effect's fetch-based client and call
`Effect.runPromise`:

```ts
import { AbsRequest, readAbs } from "@ausecon/core";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

// Table 1 of the Wage Price Index.
const wages = await Effect.runPromise(
  readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0", tableNumbers: ["1"] })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);

console.log(wages[0]);
```

`readAbs` returns a read-only array of series, one per series ID and sheet.
Each series carries its metadata once, the table it came from, and its
observations:

```ts
{
  seriesId: "A2603039T",
  seriesDescription: "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  ...",
  unit: "Index Numbers",
  seriesType: "Original",
  dataType: "INDEX",
  frequency: "Quarter",
  collectionMonth: "3",
  table: { tableId: "634501", tableTitle: "Table 1. Total Hourly Rates of Pay ..." },
  sheet: "Data1",
  observations: [
    { date: "1997-09-01", value: 67.4 },
    // ...
  ],
}
```

Series come in table order, then sheet order, then column order, and
observations in row order. Dates are ISO 8601 strings such as `1997-09-01`, so
time zones never shift a period. Blank and text cells give no observation.
The `Series`, `Table`, and `Observation` types describe this shape.

Leave out `tableNumbers` to read every table of the catalogue number. To read
series IDs instead, pass a series request:

```ts
const series = await Effect.runPromise(
  readAbs(AbsRequest.Series({ seriesIds: ["A2603039T", "A2454446F"] })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);
```

A series request returns only the requested series.

The read trims spaces from each catalogue number, table number, and series
ID, and upper-cases table numbers and series IDs. A four-digit catalogue
number such as `6345` gains `.0`.

## Errors

`Effect.runPromise` rejects when the read fails. Inside Effect code, the
error channel holds one of these tagged errors:

- `InvalidRequest`: a catalogue number, table number, or series ID is not
  valid.
- `CatalogueNotFound`: the Time Series Directory has no series for the
  catalogue number.
- `TableNotFound`: the catalogue number has no table with a requested table
  number.
- `SeriesNotFound`: the Time Series Directory has no record of a series ID.
- `WorkbookLayoutError`: a table does not have the ABS time series
  layout.
- `HttpClientError`: a request failed or the ABS answered with a status
  outside 2xx.

`WorkbookLayoutError` names the table ID and, when a sheet fails the check,
the sheet. A file that does not open as `.xlsx` gives the error without a
sheet. Each data sheet must hold `Series ID` in column A of row 10, and the
five metadata labels `Unit`, `Series Type`, `Data Type`, `Frequency`, and
`Collection Month` in column A of rows 2 to 9. Below row 10, column A must
hold a date, a blank, or a note that contains `Trend Break` or `see`.

## Your Own `HttpClient`

Any `HttpClient` layer works. The library sends its own User-Agent, follows
redirects, and fails on any status outside 2xx, so the client only needs to
send requests.

## Links

- [Command-line tool](https://www.npmjs.com/package/ausecon)
- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [Changelog](https://github.com/jackemcpherson/ausecon/blob/main/CHANGELOG.md)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
