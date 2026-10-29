import { ConfigProvider, Effect, Layer, Stdio, Terminal } from "effect";
import { TestConsole } from "effect/testing";

import type { Reader } from "../src/reader";
import { runAusecon } from "../src/run";
import { CliTestLayer, testTerminal } from "./cli-test-layer";

/** What one in-process run of the tool printed, and its exit code. */
export interface CliRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** The terminal and environment that a test run sees. */
export interface CliEnvironment {
  readonly isTerminal?: boolean;
  readonly env?: Readonly<Record<string, string>>;
  readonly columns?: number;
}

/**
 * Run `ausecon` in process with captured output.
 *
 * @param argv - The arguments after `ausecon`.
 * @param reader - The reader layer that answers the read.
 * @param environment - Whether stdout and stderr are terminals, the
 * environment variables, and the terminal width. Neither is a terminal by
 * default, no variable is set, and the terminal is 80 columns wide.
 * @returns An Effect that yields stdout, stderr, and the exit code.
 */
export const runCli = (
  argv: ReadonlyArray<string>,
  reader: Layer.Layer<Reader>,
  environment: CliEnvironment = {},
): Effect.Effect<CliRun> =>
  Effect.gen(function* () {
    const exitCode = yield* runAusecon(argv, "0.0.0-test");
    const stdout = yield* TestConsole.logLines;
    const stderr = yield* TestConsole.errorLines;

    return { stdout: stdout.join("\n"), stderr: stderr.join("\n"), exitCode };
  }).pipe(
    // The inner layers replace the `Stdio` and `Terminal` services of `CliTestLayer`.
    Effect.provide(
      Layer.mergeAll(
        reader,
        Stdio.layerTest({
          stdoutIsTerminal: Effect.succeed(environment.isTerminal ?? false),
          stderrIsTerminal: Effect.succeed(environment.isTerminal ?? false),
        }),
        ConfigProvider.layer(ConfigProvider.fromEnvRecord(environment.env ?? {})),
        Layer.succeed(Terminal.Terminal, testTerminal(environment.columns ?? 80)),
      ),
    ),
    Effect.provide(CliTestLayer),
  );
