import { Config, Console, Effect, Option, Stdio } from "effect";
import { CliOutput, Command } from "effect/cli";
import type { HttpClient } from "effect/http";

import { ausecon } from "./commands/ausecon";
import { EXIT_CODE, outcomeOf } from "./failure";
import { helpFormatter } from "./help";

/** Colour is on only when stdout and stderr are terminals and `NO_COLOR` is unset or empty. */
const hasColours: Effect.Effect<boolean, never, Stdio.Stdio> = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio;

  // A string config with a default cannot fail, so the fallback never runs.
  const noColor = yield* Config.String("NO_COLOR").pipe(
    Config.withDefault(""),
    Effect.orElseSucceed(() => ""),
  );

  return (yield* stdio.stdoutIsTerminal) && (yield* stdio.stderrIsTerminal) && noColor === "";
});

/** A console that holds `log` output in `held` and passes every other call to `console`. */
const holding = (console: Console.Console, held: Array<ReadonlyArray<unknown>>): Console.Console =>
  Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => {
      held.push(args);
    },
  });

/**
 * Run `ausecon` with the given arguments and return its exit code.
 *
 * Everything the command writes with `Console.log` is held back until it
 * finishes. On success it goes to stdout. On a failure it goes to stderr,
 * with the error message and a next step, so stdout never holds partial data
 * or help text.
 *
 * @param argv - The arguments after `ausecon`.
 * @param version - The version that `--version` prints.
 * @returns An Effect that yields the exit code.
 */
export const runAusecon = (
  argv: ReadonlyArray<string>,
  version: string,
): Effect.Effect<number, never, Command.Environment | HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const formatter = helpFormatter(yield* hasColours);
    const console = yield* Console.Console;
    const held: Array<ReadonlyArray<unknown>> = [];

    const exit = yield* Command.runWith(ausecon, { version, renderErrors: false })(argv).pipe(
      Effect.provideService(Console.Console, holding(console, held)),
      Effect.provideService(CliOutput.Formatter, formatter),
      Effect.exit,
    );

    const outcome = outcomeOf(exit, formatter);
    const write = outcome.exitCode === EXIT_CODE.success ? Console.log : Console.error;

    yield* Effect.forEach(held, (args) => write(...args), { discard: true });

    if (Option.isSome(outcome.message)) {
      yield* Console.error(outcome.message.value);
    }

    return outcome.exitCode;
  });
