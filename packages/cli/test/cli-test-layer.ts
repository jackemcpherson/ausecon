import { Effect, FileSystem, Layer, Path, Stdio, Terminal } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { TestConsole } from "effect/testing";

/**
 * A terminal of the given width that tests cannot read input from.
 *
 * @param columns - The width the terminal reports. A pipe reports 0.
 * @returns The terminal.
 */
export const testTerminal = (columns: number): Terminal.Terminal =>
  Terminal.make({
    columns: Effect.succeed(columns),
    rows: Effect.succeed(24),
    readInput: Effect.die("Tests do not read terminal input."),
    readLine: Effect.die("Tests do not read terminal input."),
    display: () => Effect.void,
  });

/** Platform services for running commands in process, with captured console output. */
export const CliTestLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(Terminal.Terminal, testTerminal(80)),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Tests do not spawn processes.")),
  ),
  TestConsole.layer,
);
