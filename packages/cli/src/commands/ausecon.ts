import { Command } from "effect/cli";

import { abs } from "./abs";
import { get } from "./get";
import { rba } from "./rba";
import { searchCommand } from "./search";

/** The root `ausecon` command. Subcommands attach here. */
export const ausecon = Command.make("ausecon").pipe(
  Command.withDescription("Read Australian economic data from the ABS and RBA."),
  Command.withSubcommands([abs, rba, get, searchCommand]),
);
