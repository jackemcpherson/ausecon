import {
  AbsRequest,
  type InvalidRequest,
  type Publisher,
  RbaRequest,
  type ResolvedSeriesId,
  type Series,
  resolveSeriesId,
} from "@ausecon/core";
import { Console, Effect, Result, Stdio } from "effect";
import { Argument, CliError, Command } from "effect/cli";

import { CommandInvalidRequest } from "../failure";
import { renderSeries } from "../output";
import { Reader } from "../reader";
import { outputFlags } from "./output-flags";

const config = {
  seriesIds: Argument.String("series-id").pipe(
    Argument.withDescription(
      "Series ID to read, such as A2603039T (ABS) or FIRMMCRTD (RBA). " +
        "Prefix abs: or rba: to name the publisher. Pass one or more.",
    ),
    Argument.atLeast(1),
  ),
  ...outputFlags,
};

/** The parsed arguments and flags of `ausecon get`. */
type GetInput = Command.Command.Config.Infer<typeof config>;

/**
 * Resolve each series ID to its publisher, or fail with a usage error that
 * names every argument that is not a series ID.
 */
const resolveAll = (
  inputs: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<ResolvedSeriesId>, CliError.ValidationError> =>
  Effect.forEach(inputs, (input) => Effect.result(resolveSeriesId(input))).pipe(
    Effect.flatMap((results) => {
      const invalid = inputs.filter((_, index) => results[index]?._tag === "Failure");

      return invalid.length === 0
        ? Effect.succeed(results.filter(Result.isSuccess).map(({ success }) => success))
        : Effect.fail(
            new CliError.ValidationError({
              message: `Expected a series ID such as A2603039T or FIRMMCRTD, got ${invalid.join(", ")}.`,
            }),
          );
    }),
  );

/** The series IDs of one publisher, in request order, each once. */
const seriesIdsOf = (
  resolved: ReadonlyArray<ResolvedSeriesId>,
  publisher: Publisher,
): ReadonlyArray<string> => [
  ...new Set(resolved.flatMap((one) => (one.publisher === publisher ? [one.seriesId] : []))),
];

/** The key that ties a Series to the series ID it answers. */
const keyOf = ({ publisher, seriesId }: ResolvedSeriesId | Series): string =>
  `${publisher}:${seriesId}`;

/** Name `ausecon get` in the next step of a request the library rejects. */
const namingGet = (error: InvalidRequest) =>
  Effect.fail(new CommandInvalidRequest({ command: "get", message: error.message }));

/**
 * Read the series IDs of each publisher, both at once, and put the Series in
 * request order. An ABS series ID can return several Series, one per sheet:
 * they stay together at the position of their series ID. A series ID passed
 * twice is read and written once.
 */
const readInOrder = Effect.fn("readInOrder")(function* (resolved: ReadonlyArray<ResolvedSeriesId>) {
  const reader = yield* Reader;
  const absSeriesIds = seriesIdsOf(resolved, "ABS");
  const rbaSeriesIds = seriesIdsOf(resolved, "RBA");

  const [absSeries, rbaSeries] = yield* Effect.all(
    [
      absSeriesIds.length === 0
        ? Effect.succeed([])
        : reader
            .readAbs(AbsRequest.Series({ seriesIds: absSeriesIds }))
            .pipe(Effect.catchTag("InvalidRequest", namingGet)),
      rbaSeriesIds.length === 0
        ? Effect.succeed([])
        : reader
            .readRba(RbaRequest.Series({ seriesIds: rbaSeriesIds }))
            .pipe(Effect.catchTag("InvalidRequest", namingGet)),
    ],
    { concurrency: "unbounded" },
  );

  const byKey = Map.groupBy<string, Series>([...absSeries, ...rbaSeries], keyOf);

  return [...new Set(resolved.map(keyOf))].flatMap((key) => byKey.get(key) ?? []);
});

const read = Effect.fn("get")(function* (input: GetInput) {
  const resolved = yield* resolveAll(input.seriesIds);
  const isTerminal = yield* (yield* Stdio.Stdio).stdoutIsTerminal;
  const series = yield* readInOrder(resolved);

  yield* Console.log(
    renderSeries(series, { format: input.format, hasMetadata: input.hasMetadata, isTerminal }),
  );
});

/** The `ausecon get` command: read series IDs from both publishers to stdout. */
export const get = Command.make("get", config, read).pipe(
  // Validation runs while arguments are parsed, so a usage error shows help. It
  // cannot pass the resolved series IDs on, so the handler resolves them again.
  Command.validate((input) => Effect.asVoid(resolveAll(input.seriesIds))),
  Command.withDescription(
    "Read series IDs from the ABS and the RBA and write the observations to stdout, in the order given. " +
      "Each series ID names its publisher by its pattern, or by an abs: or rba: prefix.",
  ),
  Command.withExamples([
    {
      command: "ausecon get A2603039T FIRMMCRTD",
      description: "Read an ABS wage index and the RBA cash rate target as one CSV",
    },
    {
      command: "ausecon get abs:A2603039T rba:FIRMMCRTD > mixed.csv",
      description: "Name each publisher with a prefix",
    },
    {
      command: "ausecon get A2603039T FIRMMCRTD --format json --no-metadata",
      description: "Print each series ID and its observations as JSON, without metadata",
    },
  ]),
);
