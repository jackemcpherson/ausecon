import { ConfigProvider, Effect, Layer, Stdio } from "effect";
import type { HttpClient } from "effect/http";
import { TestConsole } from "effect/testing";

import { runAusecon } from "../src/run";
import { CliTestLayer } from "./cli-test-layer";

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
}

/**
 * Run `ausecon` in process with captured output.
 *
 * @param argv - The arguments after `ausecon`.
 * @param http - The `HttpClient` layer that serves the requests.
 * @param environment - Whether stdout and stderr are terminals, and the
 * environment variables. Neither is a terminal by default, and no variable is
 * set.
 * @returns An Effect that yields stdout, stderr, and the exit code.
 */
export const runCli = (
  argv: ReadonlyArray<string>,
  http: Layer.Layer<HttpClient.HttpClient>,
  environment: CliEnvironment = {},
): Effect.Effect<CliRun> =>
  Effect.gen(function* () {
    const exitCode = yield* runAusecon(argv, "0.0.0-test");
    const stdout = yield* TestConsole.logLines;
    const stderr = yield* TestConsole.errorLines;

    return { stdout: stdout.join("\n"), stderr: stderr.join("\n"), exitCode };
  }).pipe(
    // The inner layers replace the `Stdio` service of `CliTestLayer`.
    Effect.provide(
      Layer.mergeAll(
        http,
        Stdio.layerTest({
          stdoutIsTerminal: Effect.succeed(environment.isTerminal ?? false),
          stderrIsTerminal: Effect.succeed(environment.isTerminal ?? false),
        }),
        ConfigProvider.layer(ConfigProvider.fromEnvRecord(environment.env ?? {})),
      ),
    ),
    Effect.provide(CliTestLayer),
  );
