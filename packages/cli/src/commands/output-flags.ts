import { Flag } from "effect/cli";

import { OUTPUT_FORMATS } from "../output";

/** The output flags that every `get` command takes: `--format` and `--no-metadata`. */
export const outputFlags = {
  format: Flag.Literals("format", OUTPUT_FORMATS).pipe(
    Flag.withDescription("Output format: csv or json."),
    Flag.withDefault("csv"),
  ),
  hasMetadata: Flag.Boolean("no-metadata").pipe(
    Flag.withDescription(
      "Leave out the metadata: write series ID, date, and value as CSV, or series ID and observations as JSON.",
    ),
    Flag.withoutNegation,
    Flag.withDefault(false),
    Flag.map((hasNoMetadata) => !hasNoMetadata),
  ),
};
