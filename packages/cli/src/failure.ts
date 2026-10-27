import type { ReadAbsError } from "@ausecon/core";
import { Cause, Exit, Match, Option } from "effect";
import type { CliError, CliOutput } from "effect/cli";

/** Exit codes of the tool. */
export const EXIT_CODE = {
  success: 0,
  failure: 1,
  usage: 2,
  notFound: 3,
  network: 4,
} as const;

/** Every error a command can fail with. */
export type CommandError = ReadAbsError | CliError.CliError;

/** How a run ended: its exit code, and the message for stderr, if any. */
export interface Outcome {
  readonly exitCode: number;
  readonly message: Option.Option<string>;
}

const outcome = (exitCode: number, message: string, nextStep: string): Outcome => ({
  exitCode,
  message: Option.some(`ausecon: ${message}\n${nextStep}`),
});

const USAGE_HINT = "Run `ausecon abs get --help` for usage and examples.";

const ISSUES = "https://github.com/jackemcpherson/ausecon/issues";

/** Describe a failed command for a terminal user. */
const describeError = (formatter: CliOutput.Formatter): ((error: CommandError) => Outcome) =>
  Match.type<CommandError>().pipe(
    Match.tag("ShowHelp", (error): Outcome =>
      error.errors.length === 0
        ? { exitCode: EXIT_CODE.success, message: Option.none() }
        : {
            exitCode: EXIT_CODE.usage,
            message: Option.some(formatter.formatErrors(error.errors)),
          },
    ),
    Match.tag("InvalidRequest", (error) => outcome(EXIT_CODE.usage, error.message, USAGE_HINT)),
    Match.tag("CatalogueNotFound", (error) =>
      outcome(
        EXIT_CODE.notFound,
        `The Time Series Directory has no series for catalogue number ${error.catalogueNumber}.`,
        "Check the catalogue number on the ABS website, such as 6345.0 for the Wage Price Index.",
      ),
    ),
    Match.tag("TableNotFound", (error) =>
      outcome(
        EXIT_CODE.notFound,
        `Catalogue number ${error.catalogueNumber} has no table numbered ${error.tableNumbers.join(", ")}.`,
        "Leave out --table to read every table, then pick table numbers from the tableTitle column.",
      ),
    ),
    Match.tag("SeriesNotFound", (error) =>
      outcome(
        EXIT_CODE.notFound,
        `The Time Series Directory has no record of series ID ${error.seriesIds.join(", ")}.`,
        "Check the series ID in the ABS table that holds it.",
      ),
    ),
    Match.tag("HttpClientError", (error) =>
      outcome(
        EXIT_CODE.network,
        `Could not read from the ABS: ${error.message}`,
        "Check your network connection, then try again. The ABS website may be down.",
      ),
    ),
    Match.tag("WorkbookLayoutError", (error) =>
      outcome(
        EXIT_CODE.failure,
        `Table ${error.tableId} does not have the ABS time series layout: ${error.reason}`,
        `Report this at ${ISSUES} with the command you ran.`,
      ),
    ),
    Match.orElse((error) => ({
      exitCode: EXIT_CODE.usage,
      message: Option.some(formatter.formatError(error)),
    })),
  );

/**
 * Decide the exit code and stderr message for a finished command.
 *
 * Usage errors exit 2, missing data 3, network and HTTP errors 4, and any
 * other failure 1.
 *
 * @param exit - The result of running the command.
 * @param formatter - The help formatter, used for `effect/cli` errors.
 * @returns The exit code and the message for stderr.
 */
export const outcomeOf = (
  exit: Exit.Exit<void, CommandError>,
  formatter: CliOutput.Formatter,
): Outcome =>
  Exit.match(exit, {
    onSuccess: (): Outcome => ({ exitCode: EXIT_CODE.success, message: Option.none() }),
    onFailure: (cause) =>
      Option.match(Cause.findErrorOption(cause), {
        onSome: describeError(formatter),
        onNone: () =>
          outcome(
            EXIT_CODE.failure,
            `failed unexpectedly.\n${Cause.pretty(cause)}`,
            `Report this at ${ISSUES}.`,
          ),
      }),
  });
