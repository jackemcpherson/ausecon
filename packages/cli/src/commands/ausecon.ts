import { Command } from "effect/cli";

import { abs } from "./abs";

/** The root `ausecon` command. Subcommands attach here. */
export const ausecon = Command.make("ausecon").pipe(
  Command.withDescription("Read Australian economic data from the ABS and RBA."),
  Command.withSubcommands([abs]),
);
