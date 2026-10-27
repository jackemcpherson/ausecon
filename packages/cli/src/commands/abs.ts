import { Command } from "effect/cli";

import { absGet } from "./abs-get";

/** The `ausecon abs` noun: Australian Bureau of Statistics data. */
export const abs = Command.make("abs").pipe(
  Command.withDescription("Read data from the Australian Bureau of Statistics (ABS)."),
  Command.withSubcommands([absGet]),
);
