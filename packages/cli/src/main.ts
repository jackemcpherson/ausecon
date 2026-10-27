#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Runtime, Schema, Stdio } from "effect";
import { FetchHttpClient } from "effect/http";

import packageJson from "../package.json" with { type: "json" };
import { runAusecon } from "./run";

/** Ends the process with a non-zero exit code. `runAusecon` has already written the message. */
class ExitCode extends Schema.TaggedError<ExitCode>()("ExitCode", { code: Schema.Number }) {
  override get [Runtime.errorExitCode](): number {
    return this.code;
  }
}

Effect.gen(function* () {
  const argv = yield* (yield* Stdio.Stdio).args;
  const code = yield* runAusecon(argv, packageJson.version);

  if (code !== 0) {
    return yield* new ExitCode({ code });
  }
}).pipe(
  Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  NodeRuntime.runMain({ disableErrorReporting: true }),
);
