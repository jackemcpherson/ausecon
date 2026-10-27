import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Command } from "effect/cli";
import { TestConsole } from "effect/testing";

import { ausecon } from "../../src/commands/ausecon";
import { CliTestLayer } from "../cli-test-layer";

describe("ausecon", () => {
  it.effect("prints the version passed by the entry point", () =>
    Effect.gen(function* () {
      yield* Command.runWith(ausecon, { version: "1.2.3" })(["--version"]);

      const lines = yield* TestConsole.logLines;

      expect(lines.join("\n")).toContain("1.2.3");
    }).pipe(Effect.provide(CliTestLayer)),
  );
});
