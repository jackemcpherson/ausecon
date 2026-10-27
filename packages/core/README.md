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

Each observation holds the 12 `readabs` columns in camelCase: `tableId`,
`sheet`, `tableTitle`, `date`, `seriesDescription`, `value`, `seriesType`,
`dataType`, `collectionMonth`, `frequency`, `seriesId`, and `unit`. Dates are
ISO 8601 strings such as `1997-09-01`.

Leave out `tableNumbers` to read every table of the catalogue number. To read
series IDs instead, pass a series request:

```ts
const series = await Effect.runPromise(
  readAbs(AbsRequest.Series({ seriesIds: ["A2603039T", "A2454446F"] })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);
```

Pass `{ metadata: false }` as the second argument to get only the series ID,
date, and value of each observation.

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
