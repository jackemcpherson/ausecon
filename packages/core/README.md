# `@ausecon/core`

`@ausecon/core` is a TypeScript library that reads Australian economic data
from the Australian Bureau of Statistics (ABS) and the Reserve Bank of
Australia (RBA). It ports the `readabs` and `readrba` R packages and uses
[Effect](https://effect.website).

The library uses no Node, Bun, or Deno APIs. It runs on Node 22.18 or later,
Bun, and Deno.

---

## Status

The library is in development. No release exists.

The first release reads ABS time series by catalogue number and table number,
or by series ID. The package now exports these schemas and errors:

- `CatalogueNumber`, such as `6202.0` or `6291.0.55.001`
- `SeriesId`, such as `A84423050A`
- `TableNumber`, such as `1`, `5a`, or `X28`
- `SeriesNotFound`, the error when the Time Series Directory has no record of
  a series

```ts
import { CatalogueNumber } from "@ausecon/core";
import { Schema } from "effect";

Schema.is(CatalogueNumber)("6202.0"); // true
Schema.is(CatalogueNumber)("6202"); // false
```

## Install

```shell
npm install @ausecon/core effect
```

## Links

- [Command-line tool](https://www.npmjs.com/package/ausecon)
- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
