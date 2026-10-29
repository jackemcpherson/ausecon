import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

const AGENT_DIRECTORIES = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
];

const IGNORED = [...AGENT_DIRECTORIES, "tools/oxlint/anti-slop/**", "**/dist/**", "**/coverage/**"];

const isLiveRun = process.env["AUSECON_LIVE"] === "1";

const coreSource = (path: string): string =>
  fileURLToPath(new URL(`./packages/core/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ausecon/core": coreSource("index.ts"),
    },
  },
  lint: {
    ignorePatterns: IGNORED,
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
    },
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
      { name: "house", specifier: "./tools/oxlint/house/index.ts" },
    ],
    rules: {
      // Style guide rules.
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unnecessary-condition": "error",
      "typescript/no-unnecessary-type-assertion": "error",

      // Rules that enforce other style guide sections.
      "typescript/explicit-module-boundary-types": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/consistent-type-definitions": ["error", "interface"],
      "typescript/array-type": ["error", { default: "generic", readonly: "generic" }],
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-array-sort": "error",
      "unicorn/no-array-reverse": "error",
      "vitest/consistent-test-filename": "error",

      // Every generic anti-slop rule, with its native companion rule.
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",

      // Every Effect anti-slop rule.
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
    },
    overrides: [
      {
        // The core runs on any runtime and keeps failures in the Effect error channel.
        files: ["packages/core/src/**"],
        rules: {
          "eslint/no-restricted-globals": ["error", "Bun", "Deno", "process", "Buffer"],
          "house/no-domain-throw": "error",
        },
      },
      {
        // Entry points and tests sit at the boundary with untyped input.
        files: ["packages/cli/src/main.ts", "**/test/**", "tools/**"],
        rules: {
          "anti-slop/no-unknown-parameters": "off",
        },
      },
    ],
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    printWidth: 100,
    // rumdl owns Markdown formatting, and the Vale styles are copied from the house precedent.
    // Fixtures are recordings and stay byte for byte as the publisher served them.
    ignorePatterns: [...IGNORED, "**/*.md", "styles/**", "packages/testkit/fixtures/**"],
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      // The entry point only wires layers. CI runs the built binary instead.
      exclude: ["packages/cli/src/main.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
        "packages/core/src/**/*-parse.ts": {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["packages/*/test/**/*.test.ts"],
          exclude: ["packages/*/test/**/*.live.test.ts"],
          setupFiles: ["./tools/test/block-network.ts"],
        },
      },
      ...(isLiveRun
        ? [
            {
              extends: true,
              test: {
                name: "live",
                environment: "node",
                include: ["packages/*/test/**/*.live.test.ts"],
                testTimeout: 60_000,
              },
            },
          ]
        : []),
    ],
  },
  staged: {
    "*": "vp check --fix",
  },
});
