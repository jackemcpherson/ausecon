import { AbsRequest, readAbs } from "@ausecon/core";
import { Console, Effect, Option, Stdio } from "effect";
import { CliError, Command, Flag } from "effect/cli";

import { METADATA_COLUMNS, OUTPUT_FORMATS, VALUE_COLUMNS, renderObservations } from "../output";

const flags = {
  catalogue: Flag.String("catalogue").pipe(
    Flag.withDescription("Catalogue number to read, such as 6345.0."),
    Flag.optional,
  ),
  format: Flag.Literals("format", OUTPUT_FORMATS).pipe(
    Flag.withDescription("Output format: csv or json."),
    Flag.withDefault("csv"),
  ),
  noMetadata: Flag.Boolean("no-metadata").pipe(
    Flag.withDescription("Write only series ID, date, and value."),
    Flag.withoutNegation,
    Flag.withDefault(false),
  ),
};

/** The parsed flags of `ausecon abs get`. */
type GetInput = Command.Command.Config.Infer<typeof flags>;

/** Build the read request from the flags, or fail with a usage error. */
const requestOf = (input: GetInput): Effect.Effect<AbsRequest, CliError.ValidationError> =>
  Option.match(input.catalogue, {
    onNone: () =>
      Effect.fail(
        new CliError.ValidationError({ message: "Pass --catalogue <catalogue number>." }),
      ),
    onSome: (catalogueNumber) => Effect.succeed(AbsRequest.Catalogue({ catalogueNumber })),
  });

const get = Effect.fn("absGet")(function* (input: GetInput) {
  const request = yield* requestOf(input);
  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;

  const output = input.noMetadata
    ? renderObservations(
        VALUE_COLUMNS,
        yield* readAbs(request, { metadata: false }),
        input.format,
        isTerminal,
      )
    : renderObservations(METADATA_COLUMNS, yield* readAbs(request), input.format, isTerminal);

  yield* Console.log(output);
});

/** The `ausecon abs get` command: read ABS time series to stdout. */
export const absGet = Command.make("get", flags, get).pipe(
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
      command: "ausecon abs get --catalogue 6345.0 --format json --no-metadata",
      description: "Print only series ID, date, and value as JSON",
    },
  ]),
);
