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
or by series ID. The `readAbs` function now reads every table of a catalogue
number. Table numbers and series IDs come next.

`readAbs` returns an `Effect` that needs an `HttpClient`. To run it without
writing Effect code, provide the fetch-based client and call
`Effect.runPromise`:

```ts
import { AbsRequest, readAbs } from "@ausecon/core";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

const observations = await Effect.runPromise(
  readAbs(AbsRequest.Catalogue({ catalogueNumber: "6345.0" })).pipe(
    Effect.provide(FetchHttpClient.layer),
  ),
);
```

Pass `{ metadata: false }` as the second argument to get only the series ID,
date, and value of each observation.

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
