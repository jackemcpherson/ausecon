# `@ausecon/core`

`@ausecon/core` is a TypeScript library that reads Australian economic data
from the Australian Bureau of Statistics (ABS) and the Reserve Bank of
Australia (RBA). It takes its coverage from the `readabs` and `readrba` R
packages and uses
[Effect](https://effect.website).

The library uses no Node, Bun, or Deno APIs. It runs on Node 22.18 or later,
Bun, and Deno. A browser needs a proxy, because the ABS and the RBA send no
CORS headers. See [Use in a Browser](#use-in-a-browser).

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
  publisher: "ABS",
  seriesId: "A2603039T",
  description: "Quarterly Index ;  Total hourly rates of pay excluding bonuses ;  ...",
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
`readAbs` returns the ABS member of the [Series union](#the-series-union),
`AbsSeries`.

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

## Read RBA Statistical Tables

`readRba` reads current statistical tables from the Reserve Bank of
Australia (RBA). It reads whole tables by RBA table number, or series by
series ID. Like `readAbs`, it returns an `Effect` that needs an `HttpClient`:

```ts
import { RbaRequest, readRba } from "@ausecon/core";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

// Two statistical tables: the daily and monthly money market rates.
const rates = await Effect.runPromise(
  readRba(RbaRequest.Table({ tableNumbers: ["F1", "F1.1"] })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);

// The cash rate target, by its series ID.
const [cashRateTarget] = await Effect.runPromise(
  readRba(RbaRequest.Series({ seriesIds: ["FIRMMCRTD"] })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);

console.log(cashRateTarget);
```

Each RBA series carries the metadata rows of its statistical table:

```ts
{
  publisher: "RBA",
  seriesId: "FIRMMCRTD",
  title: "Cash Rate Target",
  description: "Cash Rate Target on date",
  unit: "Per cent",
  seriesType: "Original",
  frequency: "Daily",
  source: "RBA",
  publicationDate: "2026-10-29",
  table: { tableNumber: "F1", tableTitle: "Interest Rates and Yields – Money Market – Daily" },
  observations: [
    { date: "2011-01-04", value: 4.75 },
    // ...
  ],
}
```

The read finds each table through the series index that ships with the
library, so a series ID request needs no RBA table number. A series ID request
returns only the requested series, in request order. The read trims and
upper-cases each RBA table number and series ID, so `f1.1` finds F1.1.

`readRba` reads `.xlsx` and `.xls` tables. It does not read historical tables.

## The Series Union

`Series` is a union of `AbsSeries` and `RbaSeries`, tagged by `publisher`.
Both members carry these fields:

- `publisher`: `"ABS"` or `"RBA"`.
- `seriesId`, `description`, `unit`, `seriesType`, and `frequency`.
- `table`: the table that holds the series.
- `observations`: `date` and `value` pairs, in row order.

Each member adds the fields of its publisher:

| Member      | `table`                                         | Other fields                                         |
| ----------- | ----------------------------------------------- | ---------------------------------------------------- |
| `AbsSeries` | `Table`: `tableId` and an optional `tableTitle` | `dataType`, `collectionMonth`, and `sheet`           |
| `RbaSeries` | `RbaTable`: `tableNumber` and `tableTitle`      | `title`, `source`, and an optional `publicationDate` |

`publicationDate` is an ISO date. The C tables have no publication date row,
so their series leave the key out. `source` names the body that the
statistical table gives as the origin of the series, such as the ABS when the
RBA republishes ABS data.

Check `publisher` to reach the fields of one member:

```ts
import type { Series } from "@ausecon/core";

const tableOf = (series: Series): string =>
  series.publisher === "ABS" ? series.table.tableId : series.table.tableNumber;
```

## Search the Series Index

`searchSeries` searches the series index by words. It makes no request, so it
works offline. A series matches when each word appears, in any case, in its
series ID, title, description, or table title. The series index holds RBA
series only.

```ts
import { searchSeries } from "@ausecon/core";

const matches = searchSeries(["cash", "rate", "target"], { limit: 5 });

console.log(matches.map(({ seriesId, tableNumber }) => `${seriesId} (${tableNumber})`));
// [ "ARBAMPCCCR (A2)", "ARBAMPCNCRT (A2)", "AORRLFPR (A3)", "FIRMMCRTD (F1)", "FIRMMCCRT (F1)" ]
```

Each result is a `SeriesIndexEntry`: `publisher`, `seriesId`, `title`,
`description`, `unit`, `frequency`, `seriesType`, `tableNumber`, and
`tableTitle`. Results come in index order: table order, then column order.
Leave out `limit` to get every match.

## Resolve a Series ID

`resolveSeriesId` names the publisher of a series ID. An ID that matches the
ABS pattern, such as `A2603039T`, is an ABS series ID. Every other valid ID is
an RBA series ID. A prefix of `abs:` or `rba:` overrides the pattern. Use it
to split a mixed list between `readAbs` and `readRba`:

```ts
import { resolveSeriesId } from "@ausecon/core";
import { Effect } from "effect";

const resolved = await Effect.runPromise(
  Effect.forEach(["A2603039T", "firmmcrtd", "rba:FIRMMCRT"], resolveSeriesId),
);

console.log(resolved);
// [
//   { publisher: "ABS", seriesId: "A2603039T" },
//   { publisher: "RBA", seriesId: "FIRMMCRTD" },
//   { publisher: "RBA", seriesId: "FIRMMCRT" },
// ]
```

Text that is not a series ID fails with `InvalidRequest`.

## Parse a Table You Hold

`parseTable` reads the series of one ABS time series table from its `.xlsx`
bytes, with no network. It is the parser that `readAbs` uses. Pass the bytes
and the table, with the table ID and, if you know it, the title:

```ts
import { readFile } from "node:fs/promises";

import { TableId, parseTable } from "@ausecon/core";
import { Effect, Schema } from "effect";

const bytes = new Uint8Array(await readFile("634501.xlsx"));

const wages = await Effect.runPromise(
  parseTable(bytes, { tableId: Schema.decodeSync(TableId)("634501") }),
);
```

Each series carries the table as you passed it, so `tableTitle` is absent
when you leave it out. A table without the ABS time series layout fails with
`TableLayoutError`.

## Errors

`Effect.runPromise` rejects when the read fails. Inside Effect code, the
error channel of `readAbs` holds one of these tagged errors:

- `InvalidRequest`: a catalogue number, table number, or series ID is not
  valid.
- `CatalogueNotFound`: the Time Series Directory has no series for the
  catalogue number.
- `TableNotFound`: the catalogue number has no table with a requested table
  number.
- `SeriesNotFound`: the Time Series Directory has no record of a series ID.
- `TableLayoutError`: a table does not have the ABS time series layout.
- `TimeSeriesDirectoryError`: a Time Series Directory response is not a
  series index, such as an error document or malformed XML. It names the URL
  and the reason.
- `AbsUnavailable`: a request to the ABS got no response, or a status outside
  2xx. It names the URL, the status if the ABS answered, and the cause as
  text in `detail`.

The error channel of `readRba` holds one of these tagged errors:

- `InvalidRequest`: an RBA table number or series ID is not valid.
- `RbaTableNotFound`: no current table has a requested RBA table number, or
  the table URL that the series index lists answered 404. It names the RBA
  table numbers and, for a 404, the URL.
- `RbaSeriesNotFound`: the series index lists none of the series IDs, or the
  table it names does not hold them. It names every missing series ID.
- `RbaTableLayoutError`: a statistical table does not have the RBA layout,
  or the series index lists it as unreadable. It names the RBA table number,
  the URL, and the reason.
- `RbaUnavailable`: a request to the RBA got no response, or a status
  outside 2xx other than a 404 on a table URL. It names the URL, the status
  if the RBA answered, and the cause as text in `detail`.

The message of `RbaTableNotFound` and `RbaSeriesNotFound` says that the
series index may be out of date. A newer release of `@ausecon/core` may find
the table or series.

Every error is a type the library defines. No `effect/http` error reaches
the error channel.

`TableLayoutError` names the table ID and, when a sheet fails the check,
the sheet. A file that does not open as `.xlsx` gives the error without a
sheet. Each data sheet must hold `Series ID` in column A of row 10, and the
five metadata labels `Unit`, `Series Type`, `Data Type`, `Frequency`, and
`Collection Month` in column A of rows 2 to 9. Each filled cell of row 10
must hold a series ID. Below row 10, column A must hold a date, a blank, or a
note that contains `Trend Break` or `see`.

## Your Own `HttpClient`

Any `HttpClient` layer works. The library sends its own User-Agent, follows
redirects, and fails on any status outside 2xx, so the client only needs to
send requests.

## Use in a Browser

The ABS and the RBA send no CORS headers, so a browser blocks a direct read.
To read from a browser, send the requests through a proxy that you run, with
an `HttpClient` layer that rewrites each URL to the proxy. `searchSeries`
makes no request, so it needs no proxy.

## RBA Data

Source: Reserve Bank of Australia. The RBA publishes its statistical tables
under the Creative Commons Attribution 4.0 International licence. The RBA
does not endorse this project, and `@ausecon/core` is not an RBA product.

## Links

- [Command-line tool](https://www.npmjs.com/package/ausecon)
- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [Changelog](https://github.com/jackemcpherson/ausecon/blob/main/CHANGELOG.md)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)
- [RBA statistical tables](https://www.rba.gov.au/statistics/tables/)
- [RBA copyright and disclaimer](https://www.rba.gov.au/copyright/)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
