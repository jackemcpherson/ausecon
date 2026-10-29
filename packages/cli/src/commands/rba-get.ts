import { RbaRequest, RbaTableNumber } from "@ausecon/core";
import { Console, Effect, Schema, Stdio } from "effect";
import { Argument, CliError, Command } from "effect/cli";

import { CommandInvalidRequest } from "../failure";
import { renderRbaSeries } from "../output";
import { Reader } from "../reader";
import { outputFlags } from "./output-flags";

const config = {
  tableNumbers: Argument.String("rba-table-number").pipe(
    Argument.withDescription("RBA table number to read, such as F1 or F1.1. Pass one or more."),
    Argument.atLeast(1),
  ),
  ...outputFlags,
};

/** The parsed arguments and flags of `ausecon rba get`. */
type GetInput = Command.Command.Config.Infer<typeof config>;

const isRbaTableNumber = Schema.is(RbaTableNumber);

/**
 * Check each RBA table number, as the library reads it, or fail with a usage
 * error that names every one it rejects.
 */
const checkTableNumbers = (input: GetInput): Effect.Effect<void, CliError.ValidationError> => {
  const invalid = input.tableNumbers.filter(
    (tableNumber) => !isRbaTableNumber(tableNumber.trim().toUpperCase()),
  );

  return invalid.length === 0
    ? Effect.void
    : Effect.fail(
        new CliError.ValidationError({
          message: `Expected an RBA table number such as F1 or F1.1, got ${invalid.join(", ")}.`,
        }),
      );
};

const get = Effect.fn("rbaGet")(function* (input: GetInput) {
  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;

  const series = yield* (yield* Reader)
    .readRba(RbaRequest.Table({ tableNumbers: input.tableNumbers }))
    .pipe(
      Effect.catchTag("InvalidRequest", (error) =>
        Effect.fail(new CommandInvalidRequest({ command: "rba get", message: error.message })),
      ),
    );

  yield* Console.log(
    renderRbaSeries(series, { format: input.format, hasMetadata: input.hasMetadata, isTerminal }),
  );
});

/** The `ausecon rba get` command: read RBA statistical tables to stdout. */
export const rbaGet = Command.make("get", config, get).pipe(
  Command.validate(checkTableNumbers),
  Command.withDescription(
    "Read current RBA statistical tables and write the observations to stdout.",
  ),
  Command.withExamples([
    {
      command: "ausecon rba get F1",
      description: "Read the cash rate and money market rates as CSV",
    },
    {
      command: "ausecon rba get F1 F1.1 > rates.csv",
      description: "Save two statistical tables as one CSV file",
    },
    {
      command: "ausecon rba get F1 --format json --no-metadata",
      description: "Print each series ID and its observations as JSON, without metadata",
    },
  ]),
);
