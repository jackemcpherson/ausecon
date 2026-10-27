import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { fixtureHttpClient } from "../../../core/test/fixture-http-client";
import { runCli } from "../run-cli";

const noRequests = fixtureHttpClient(new Map());

describe("ausecon", () => {
  it.effect("prints the version passed by the entry point", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["--version"], noRequests.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0.0.0-test");
    }),
  );

  it.effect("prints shell completions that include abs get", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["--completions", "bash"], noRequests.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("abs");
      expect(result.stdout).toContain("get");
      expect(result.stdout).toContain("--catalogue");
    }),
  );

  it.effect("prints help to stdout and exits 0 for a noun with no verb", () =>
    Effect.gen(function* () {
      const result = yield* runCli(["abs"], noRequests.layer);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("get");
      expect(result.stderr).toBe("");
    }),
  );
});
