import { Command } from "effect/cli";

import { rbaGet } from "./rba-get";

/** The `ausecon rba` noun: Reserve Bank of Australia data. */
export const rba = Command.make("rba").pipe(
  Command.withDescription("Read data from the Reserve Bank of Australia (RBA)."),
  Command.withSubcommands([rbaGet]),
);
