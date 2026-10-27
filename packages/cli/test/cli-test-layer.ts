import { Effect, FileSystem, Layer, Path, Stdio, Terminal } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { TestConsole } from "effect/testing";

/** Platform services for running commands in process, with captured console output. */
export const CliTestLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.die("Tests do not read terminal input."),
      readLine: Effect.die("Tests do not read terminal input."),
      display: () => Effect.void,
    }),
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Tests do not spawn processes.")),
  ),
  TestConsole.layer,
);
