#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Command } from "effect/cli";

import packageJson from "../package.json" with { type: "json" };
import { ausecon } from "./commands/ausecon";

Command.run(ausecon, { version: packageJson.version }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
