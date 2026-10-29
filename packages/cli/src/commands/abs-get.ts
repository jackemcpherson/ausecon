import { AbsRequest } from "@ausecon/core";
import { Console, Effect, Option, Stdio } from "effect";
import { CliError, Command, Flag } from "effect/cli";

import { renderAbsSeries } from "../output";
import { Reader } from "../reader";
import { outputFlags } from "./output-flags";

const flags = {
  catalogue: Flag.String("catalogue").pipe(
    Flag.withDescription("Catalogue number to read, such as 6345.0."),
    Flag.optional,
  ),
  table: Flag.String("table").pipe(
    Flag.withDescription("Table number to read, such as 1 or 7a. Repeat for more tables."),
    Flag.atLeast(0),
  ),
  series: Flag.String("series").pipe(
    Flag.withDescription(
      "Deprecated: use `ausecon get`. Series ID to read, such as A2603039T. Repeat for more series.",
    ),
    Flag.atLeast(0),
  ),
  ...outputFlags,
};

/** The parsed flags of `ausecon abs get`. */
type GetInput = Command.Command.Config.Infer<typeof flags>;

const usageError = (message: string): Effect.Effect<never, CliError.ValidationError> =>
  Effect.fail(new CliError.ValidationError({ message }));

/**
 * Build the read request from the flags, or fail with a usage error.
 *
 * `--catalogue` and `--series` exclude each other, and one of them is needed.
 * `--table` needs `--catalogue`.
 */
const requestOf = (input: GetInput): Effect.Effect<AbsRequest, CliError.ValidationError> =>
  Option.match(input.catalogue, {
    onNone: () =>
      input.table.length > 0
        ? usageError("--table needs --catalogue <catalogue number>.")
        : input.series.length === 0
          ? usageError("Pass --catalogue <catalogue number> or --series <series ID>.")
          : Effect.succeed(AbsRequest.Series({ seriesIds: input.series })),
    onSome: (catalogueNumber) =>
      input.series.length > 0
        ? usageError("Pass --catalogue or --series, not both.")
        : Effect.succeed(AbsRequest.Catalogue({ catalogueNumber, tableNumbers: input.table })),
  });

/** The stderr note for `--series`, which the next release removes. */
const SERIES_NOTE =
  "ausecon: --series is deprecated and the next release removes it. " +
  "Use `ausecon get <series id...>`, which reads ABS and RBA series IDs.";

const get = Effect.fn("absGet")(function* (input: GetInput) {
  const request = yield* requestOf(input);

  if (input.series.length > 0) {
    yield* Console.error(SERIES_NOTE);
  }

  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;
  const series = yield* (yield* Reader).readAbs(request);

  yield* Console.log(
    renderAbsSeries(series, { format: input.format, hasMetadata: input.hasMetadata, isTerminal }),
  );
});

/** The `ausecon abs get` command: read ABS time series to stdout. */
export const absGet = Command.make("get", flags, get).pipe(
  // Validation runs while flags are parsed, so a usage error shows help. It cannot
  // pass the request on, so the handler builds it again.
  Command.validate((input) => Effect.asVoid(requestOf(input))),
  Command.withDescription(
    "Read ABS time series from the latest release and write the observations to stdout. " +
      "Large catalogue numbers such as 6202.0 have many pages and tables, so pass table numbers or series IDs.",
  ),
  Command.withExamples([
    {
      command: "ausecon abs get --catalogue 6345.0 > wages.csv",
      description: "Save every table of the Wage Price Index as CSV",
    },
    {
      command: "ausecon abs get --catalogue 6202.0 --table 1 --table 12",
      description: "Read only tables 1 and 12 of the Labour Force release",
    },
    {
      command: "ausecon abs get --series A2603039T --series A2454446F",
      description: "Read a watch list of series IDs from any catalogue numbers",
    },
    {
      command: "ausecon abs get --catalogue 6345.0 --format json --no-metadata",
      description: "Print each series ID and its observations as JSON, without metadata",
    },
  ]),
);
