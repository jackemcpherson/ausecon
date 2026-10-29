import type {
  AbsUnavailable,
  RbaUnavailable,
  ReadAbsError,
  ReadRbaError,
  TableLayoutError,
} from "@ausecon/core";
import { Cause, Exit, Match, Option, Schema } from "effect";
import { CliError, type CliOutput } from "effect/cli";

/** Exit codes of the tool. */
export const EXIT_CODE = {
  success: 0,
  failure: 1,
  usage: 2,
  notFound: 3,
  unavailable: 4,
} as const;

/**
 * An RBA request that failed decoding. `ausecon rba get` turns the library's
 * `InvalidRequest` into this error: `ReadAbsError` shares that tag, and the
 * next step must name the RBA command.
 */
export class RbaInvalidRequest extends Schema.TaggedError<RbaInvalidRequest>()(
  "RbaInvalidRequest",
  { message: Schema.String },
) {}

/** The RBA read errors, as `ausecon rba get` fails with them. */
export type RbaCommandError =
  | Exclude<ReadRbaError, { readonly _tag: "InvalidRequest" }>
  | RbaInvalidRequest;

/** Every read error a command can fail with. */
type ReadError = ReadAbsError | RbaCommandError;

/** Every error a command can fail with. */
export type CommandError = ReadError | CliError.CliError;

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

const RBA_USAGE_HINT = "Run `ausecon rba get --help` for usage and examples.";

const ISSUES = "https://github.com/jackemcpherson/ausecon/issues";

const UPDATE_AUSECON = "update ausecon with `npm install --global ausecon@latest`, then try again.";

/** The table, and the sheet if known, that a layout error names. */
const layoutSubject = (error: TableLayoutError): string =>
  error.sheet === undefined
    ? `Table ${error.tableId}`
    : `Table ${error.tableId}, sheet ${error.sheet},`;

const REPORT_IT = `Report this at ${ISSUES} with the command you ran.`;

/**
 * Describe a request to a publisher that failed. The library words the detail,
 * status included, so the message only adds the URL. A status means the
 * publisher answered, so the next step is to wait or report moved data. No
 * status points at the network.
 */
const describeUnavailable = (
  error: AbsUnavailable | RbaUnavailable,
  publisher: "ABS" | "RBA",
): Outcome =>
  outcome(
    EXIT_CODE.unavailable,
    `Could not read ${error.url}: ${error.detail}`,
    error.status === undefined
      ? `Check your network connection, then try again. The ${publisher} website may be down.`
      : `Try again later. The ${publisher} website may be down, or the data may have moved: if the error stays, report it at ${ISSUES}.`,
  );

/** Describe a command-line usage error, or a help request, for a terminal user. */
const describeCliError = (
  formatter: CliOutput.Formatter,
): ((error: CliError.CliError) => Outcome) =>
  Match.type<CliError.CliError>().pipe(
    Match.tag("ShowHelp", (error): Outcome =>
      error.errors.length === 0
        ? { exitCode: EXIT_CODE.success, message: Option.none() }
        : {
            exitCode: EXIT_CODE.usage,
            message: Option.some(formatter.formatErrors(error.errors)),
          },
    ),
    Match.orElse((error) => ({
      exitCode: EXIT_CODE.usage,
      message: Option.some(formatter.formatError(error)),
    })),
  );

/**
 * Describe a failed read for a terminal user. The match is exhaustive, so a new
 * read error does not compile until it has an exit code and a next step.
 *
 * Each RBA failure exits with the code of its ABS counterpart. A missing RBA
 * table can mean that the series index that ships with ausecon is out of
 * date, so its next step is to update ausecon.
 */
const describeReadError: (error: ReadError) => Outcome = Match.type<ReadError>().pipe(
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
      `Found no series ID ${error.seriesIds.join(", ")} in the Time Series Directory or the table it names.`,
      "Check the series ID in the ABS table that holds it.",
    ),
  ),
  Match.tag("AbsUnavailable", (error) => describeUnavailable(error, "ABS")),
  Match.tag("TimeSeriesDirectoryError", (error) =>
    outcome(
      EXIT_CODE.failure,
      `Time Series Directory fault at ${error.url}: ${error.reason}`,
      REPORT_IT,
    ),
  ),
  Match.tag("TableLayoutError", (error) =>
    outcome(
      EXIT_CODE.failure,
      `${layoutSubject(error)} does not have the ABS time series layout: ${error.reason}`,
      REPORT_IT,
    ),
  ),
  Match.tag("RbaInvalidRequest", (error) =>
    outcome(EXIT_CODE.usage, error.message, RBA_USAGE_HINT),
  ),
  Match.tag("RbaTableNotFound", (error) =>
    outcome(
      EXIT_CODE.notFound,
      error.message,
      error.url === undefined
        ? `Check the RBA table number on the RBA website, such as F1 for the cash rate. If it is right, ${UPDATE_AUSECON}`
        : `The RBA may have moved the table: ${UPDATE_AUSECON}`,
    ),
  ),
  Match.tag("RbaUnavailable", (error) => describeUnavailable(error, "RBA")),
  Match.tag("RbaTableLayoutError", (error) =>
    outcome(
      EXIT_CODE.failure,
      `Statistical table ${error.tableNumber} at ${error.url} does not have the RBA layout: ${error.reason}`,
      REPORT_IT,
    ),
  ),
  Match.exhaustive,
);

/** Describe a failed command for a terminal user. */
const describeError =
  (formatter: CliOutput.Formatter) =>
  (error: CommandError): Outcome =>
    CliError.isCliError(error) ? describeCliError(formatter)(error) : describeReadError(error);

/**
 * Decide the exit code and stderr message for a finished command.
 *
 * Usage errors exit 2, missing data 3, an unavailable ABS or RBA 4, and any
 * other failure 1, including a Time Series Directory or table layout fault.
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
