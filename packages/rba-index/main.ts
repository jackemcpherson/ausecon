import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

import type { SeriesIndex } from "../core/src/rba/series-index";
import { SERIES_INDEX } from "../core/src/rba/series-index-data";
import { rebuildSeriesIndex } from "./index-build";
import { renderSeriesIndex } from "./index-source";

/** Accept a changed set of unreadable tables. */
const ACCEPT_UNREADABLE = "--accept-unreadable";

/** The generated module in the library. */
const INDEX_FILE = fileURLToPath(new URL("../core/src/rba/series-index-data.ts", import.meta.url));

/** Write the index into the library, format it, and summarise it. */
const writeIndex = (index: SeriesIndex): void => {
  writeFileSync(INDEX_FILE, renderSeriesIndex(index));

  execFileSync("vp", ["fmt", INDEX_FILE], { stdio: "inherit" });

  console.log(
    `Wrote ${index.series.length} series from ${index.tables.length} tables to ${INDEX_FILE}.`,
  );

  for (const { tableNumber, reason } of index.unreadableTables) {
    console.log(`Unreadable: ${tableNumber}: ${reason}`);
  }
};

const acceptUnreadable = process.argv.slice(2).includes(ACCEPT_UNREADABLE);

await Effect.runPromise(
  rebuildSeriesIndex(SERIES_INDEX, acceptUnreadable).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.match({
      onFailure: (error) => {
        console.error(`rba:index: ${error.message}`);
        process.exitCode = 1;
      },
      onSuccess: writeIndex,
    }),
  ),
);
