import { Console, Effect, Option, Stdio, Terminal } from "effect";
import { Argument, CliError, Command, Flag } from "effect/cli";

import { OUTPUT_FORMATS } from "../output";
import { Reader } from "../reader";
import { DEFAULT_TERMINAL_WIDTH, renderSearchResults } from "../search-output";

const DEFAULT_LIMIT = 20;

const config = {
  words: Argument.String("word").pipe(
    Argument.withDescription(
      "Word to search for, such as cash. Pass one or more: a series matches only if it has every word.",
    ),
    Argument.atLeast(1),
  ),
  limit: Flag.Int("limit").pipe(
    Flag.withDescription(`The most series to show. Defaults to ${DEFAULT_LIMIT}.`),
    Flag.withDefault(DEFAULT_LIMIT),
  ),
  format: Flag.Literals("format", OUTPUT_FORMATS).pipe(
    Flag.withDescription(
      "Output format: csv or json. Without it, a terminal gets aligned columns and a pipe gets CSV.",
    ),
    Flag.optional,
  ),
};

/** The parsed arguments and flags of `ausecon search`. */
type SearchInput = Command.Command.Config.Infer<typeof config>;

/** Reject a limit below 1 with a usage error. */
const checkLimit = (input: SearchInput): Effect.Effect<void, CliError.ValidationError> =>
  input.limit >= 1
    ? Effect.void
    : Effect.fail(
        new CliError.ValidationError({
          message: `Expected --limit to be 1 or more, got ${input.limit}.`,
        }),
      );

/** The width to fit the table to. A pipe or an unknown terminal reports 0. */
const terminalWidth: Effect.Effect<number, never, Terminal.Terminal> = Effect.gen(function* () {
  const columns = yield* (yield* Terminal.Terminal).columns;

  return columns > 0 ? columns : DEFAULT_TERMINAL_WIDTH;
});

const search = Effect.fn("search")(function* (input: SearchInput) {
  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;
  const matches = yield* (yield* Reader).search(input.words);
  const shown = matches.slice(0, input.limit);
  const format = Option.getOrUndefined(input.format);

  if (matches.length === 0) {
    yield* Console.error(
      `ausecon: No series in the series index matches ${input.words.join(" ")}.\n` +
        "Try fewer or shorter words: each word must appear in a series ID, title, description, or table title. " +
        "The series index holds RBA series only.",
    );
  } else if (shown.length < matches.length) {
    yield* Console.error(
      `ausecon: Showing ${shown.length} of ${matches.length} matching series. ` +
        `Pass --limit ${matches.length} to show them all.`,
    );
  }

  // A terminal reader needs no header row for an empty table; a pipe still
  // gets the CSV header or an empty JSON list.
  if (matches.length > 0 || format !== undefined || !isTerminal) {
    const width = yield* terminalWidth;

    yield* Console.log(renderSearchResults(shown, { format, isTerminal, width }));
  }
});

/** The `ausecon search` command: search the series index by words. */
export const searchCommand = Command.make("search", config, search).pipe(
  Command.validate(checkLimit),
  Command.withDescription(
    "Search the series index for series whose series ID, title, description, or table title " +
      "holds every word, in any case. Makes no request. Read a series with the RBA table number it shows.",
  ),
  Command.withExamples([
    {
      command: "ausecon search cash rate target",
      description: "Find the series IDs of the cash rate target",
    },
    {
      command: "ausecon search yield --limit 50",
      description: "Show up to 50 matches instead of 20",
    },
    {
      command: "ausecon search cash rate --format json",
      description: "Write every field of each match as JSON",
    },
  ]),
);
