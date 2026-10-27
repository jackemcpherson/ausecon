# TypeScript Standards and Project Structure

This document turns the published TypeScript style guide into enforceable rules
for the `abs` project. The project is a TypeScript CLI, TUI, and library that
ports Matt Cowgill's `readabs` and `readrba` R packages. It will be the
reference implementation for later TypeScript projects.

---

## Contents

- [Sources and Conflicts](#sources-and-conflicts)
- [Findings That Change the Guide's Configuration](#findings-that-change-the-guides-configuration)
- [Rule Register](#rule-register)
- [Proposed Project Structure](#proposed-project-structure)
- [Configuration Files](#configuration-files)
- [Continuous Integration and Release](#continuous-integration-and-release)
- [Open Questions](#open-questions)
- [References](#references)

## Sources and Conflicts

Research used these sources on 2026-10-27:

- The published guide at `https://jackemcpherson.com/docs/typescript-style-guide.md`
  (881 lines). A raw copy is in the session scratchpad.
- The sibling guides listed at `https://jackemcpherson.com/docs/`: Markdown,
  Python, infrastructure style, and infrastructure authoring.
- The local skill at `~/.claude/skills/project-standards`. Its snapshot records
  homepage commit `4a1387f` synced at 2026-10-16T23:34:15Z.
- Package metadata and type declarations from the npm registry. Tarballs for
  `effect@4.0.6`, `vite-plus@1.4.0`, `oxlint@1.89.0`, `oxfmt@0.74.0`, and
  `@effect/vitest@4.0.6` were inspected directly.
- The sibling repositories `fitzRoy-ts` and `renovate-config` as house
  precedent. They are implementation evidence, not policy (SKILL.md rule 5).

The five local reference files are byte-identical to the published guides.
There is no conflict between the skill and the website. All conflicts below are
between the guide and the current tool releases, or between the guide's
Cloudflare Workers focus and a CLI and TUI project.

The TypeScript guide does not cover CI, versioning, release, coverage, or
Markdown. The infrastructure authoring guide supplies GitHub Actions rules. The
Markdown guide applies to every `.md` file in the repository.

## Findings That Change the Guide's Configuration

Each item below is a fault in the guide's sample configuration when applied
with current tool releases. Treat each one as a proposed correction for the
user to confirm.

### F1. The Sample `vp check` Configuration Does Not Run the Type Checker

The guide says `tsgo` runs inside `vp check` (Tech Stack, Tooling). The Vite+
check documentation states that type checks run only when both
`lint.options.typeAware` and `lint.options.typeCheck` are `true`. The
`vite-plus@1.4.0` type declarations repeat this rule. The guide sets only
`typeAware: true`, so its configuration lints with type information but does
not report compiler diagnostics.

Fix: add `typeCheck: true` under `lint.options`. The Oxlint schema describes
`typeCheck` as experimental and dependent on `oxlint-tsgolint`, which Vite+
bundles.

### F2. The Sample `fmt` Keys Are Not Oxfmt Keys

The guide uses `indentStyle`, `indentWidth`, and `lineWidth` (Vite+, Oxlint,
and Anti-Slop Configuration). Those are Biome option names. The
`oxfmt@0.74.0` configuration schema has no such properties. It uses the
Prettier-style names `useTabs`, `tabWidth`, and `printWidth`.

Fix: `fmt: { useTabs: false, tabWidth: 2, printWidth: 100 }`.

### F3. The Sample Imports `defineConfig` from `vite`

The guide imports `defineConfig` from `"vite"`. The Vite+ README and pack guide
import it from `"vite-plus"`. Vite+ installs `vite` as an alias of
`@voidzero-dev/vite-plus-core` and augments its `UserConfig` type. The `vite`
import may type-check, but `vite-plus` is the documented entry point.

Fix: `import { defineConfig } from "vite-plus";`.

### F4. The Guide's Effect Examples Use the Effect 3 API

`effect@4.0.0` was released on 2026-10-01. The current release is `4.0.6`.
Effect 3 still receives releases (`3.22.4` on 2026-10-22). The guide's code
uses Effect 3 names. Inspection of the `effect@4.0.6` declarations shows these
differences:

| Guide (Effect 3)                       | Effect 4.0.6                                      |
| -------------------------------------- | ------------------------------------------------- |
| `Effect.Service<T>()("Id", {...})`     | `Context.Service<Self, Shape>()("Id", { make })`  |
| `Schema.decodeUnknown`                 | `Schema.decodeUnknownEffect`                      |
| `ParseError` from `effect/ParseResult` | `SchemaError`                                     |
| `Schema.DateFromSelf`                  | `Schema.Date`                                     |
| `Schema.standardSchemaV1`              | `Schema.toStandardSchemaV1`                       |
| `Effect.zipRight`                      | `Effect.andThen`                                  |
| `@effect/platform` package             | Built into `effect` (`effect/http`, `FileSystem`) |
| `@effect/cli` package                  | Built into `effect` (`effect/cli`)                |

These names are unchanged: `Schema.TaggedError`, `Effect.fn`,
`Effect.catchTags`, `Effect.retry`, `Effect.tryPromise`, `Effect.partition`,
`Data.TaggedEnum`, `Match.type`, `Match.exhaustive`, and `ManagedRuntime`.

The `effect/cli` and `effect/http` modules carry `@stability unstable` tags in
their declarations.

The tool stack decides the version. Vite+ 1.4.0 bundles Vitest 5.0.5. The last
Effect 3 test helper, `@effect/vitest@0.30.1`, accepts only Vitest 3 or 4.
`@effect/vitest@4.0.6` requires Vitest 5 and Effect 4. Foldkit 0.169 also
requires Effect 4. Effect 3 therefore falls outside the supported peer
range of the guide's tooling. Bun warns on a peer mismatch but does not
refuse the install.
Recommendation: use Effect 4 and treat the guide's examples as patterns, not
exact API names (Question Q1).

### F5. TypeScript 7 Is Stable and `tsgo` Is Now `tsc`

TypeScript 7.0 was released on 2026-07-08 as the Go-native compiler. The
`typescript@7.0.2` package exposes the `tsc` binary. The
`@typescript/native-preview` package that provided `tsgo` is superseded.
TypeScript 7 changes defaults that matter here:

- `types` defaults to `[]`. Each tsconfig must list its ambient type packages.
- `strict`, `noUncheckedSideEffectImports`, and `module: esnext` are default.
- `baseUrl` and `moduleResolution: node10` are removed.

Vite+ type-checks through `oxlint-tsgolint`, which wraps the TypeScript 7
checker. A standalone `tsc -b` is still useful for project references and
declaration emit.

### F6. The Test Environment `miniflare` Does Not Apply

The guide sets `test.environment: "miniflare"`. The
`vitest-environment-miniflare` package is deprecated ("Miniflare v2 is no
longer supported"). Cloudflare now ships `@cloudflare/vitest-pool-workers`.
This project runs on Node and Bun, not `workerd`, so the correct value is
`environment: "node"`.

### F7. `vp test --run` Is Redundant

The Vite+ test guide states that `vp test` performs one run and that
`vp test watch` starts watch mode. The guide's `vp test --run` passes Vitest's
`--run` flag through and should still work. Confirm with `vp test --help` when
the project is created.

### F8. The Anti-Slop Install Command and Rule Set Have Changed

The guide installs with `bunx skills add dmmulroy/anti-slop`. The upstream
README (commit `13909c9`, 2026-10-14) uses
`npx skills add dmmulroy/anti-slop --skill install-anti-slop`. Upstream now has
18 generic rules and 5 Effect rules. The guide enables 6 generic rules and 1
Effect rule. The upstream README recommends enabling all generic rules, and all
Effect rules in Effect repositories (Question Q4).

The guide's bare string paths in `jsPlugins` are valid. The Oxlint 1.89 schema
accepts a string or a `{ name, specifier }` object. The plugin names come from
`meta.name` (`anti-slop` and `anti-slop-effect`).

The vendored plugins import `@oxlint/plugins`. Vite+ re-exports that API from
`vite-plus/lint-plugins`. Upstream requires `@oxlint/plugins` at the exact
Oxlint version. Vite+ 1.4.0 pins `oxlint` and `@oxlint/plugins` at `=1.89.0`.

## Rule Register

Status values:

- `Mechanical`: a tool fails the build.
- `Partial`: a tool catches common cases only.
- `Review`: no tool enforces the rule. Code review must check it.

### Runtime, Tooling, and Dependencies

| Rule                                                   | Guide section              | Mechanism                                                                                                                        | Status     |
| ------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Bun is the package manager, commit `bun.lock`          | Tooling, Package Scripts   | `packageManager: "bun@1.x"` field, CI `bun install --frozen-lockfile`                                                            | Mechanical |
| Vite+ runs checks, tests, and bundling                 | Tooling                    | Scripts call `vp`, CI calls the same scripts                                                                                     | Mechanical |
| `vp check` and `vp test` pass with zero warnings       | Design Principle 5         | `lint.options.denyWarnings: true`, CI step                                                                                       | Mechanical |
| No Bun-specific APIs in portable code                  | Runtime Rules              | Core tsconfig has `types: []`, so `Bun` is undeclared, `eslint/no-restricted-globals` for `Bun` and `process` in `packages/core` | Mechanical |
| Use Web Standard APIs and Effect platform abstractions | Runtime Rules              | Same as above, `eslint/no-restricted-imports` for `node:*` in core                                                               | Mechanical |
| Minimise external dependencies                         | Design Principle 6         | Renovate shared preset, review each new dependency                                                                               | Review     |
| Pin action and tool versions                           | Infra authoring: CI checks | Full commit SHAs, Renovate `helpers:pinGitHubActionDigests`                                                                      | Mechanical |

### Compiler Configuration

| Rule                                        | Guide section                     | Mechanism                                                                                     | Status     |
| ------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| `strict` and the listed strict flags        | TypeScript Configuration          | Root `tsconfig.json` copied from the guide                                                    | Mechanical |
| Split runtime types from tooling types      | TypeScript Configuration          | Separate tsconfigs per runtime with explicit `types`                                          | Mechanical |
| Explicit return types on exported functions | Interfaces, Types, and Schemas    | `isolatedDeclarations: true`, `typescript/explicit-module-boundary-types`                     | Mechanical |
| No `enum`                                   | Interfaces, Types, and Schemas    | Proposed `erasableSyntaxOnly: true` (rejects enums, runtime namespaces, parameter properties) | Mechanical |
| No `any`                                    | Interfaces, Types, and Schemas    | `typescript/no-explicit-any`, `no-unsafe-*` type-aware rules                                  | Mechanical |
| Type-only imports are explicit              | Implied by `verbatimModuleSyntax` | Compiler flag, `typescript/consistent-type-imports`                                           | Mechanical |

### Types, Schemas, and Boundaries

| Rule                                          | Guide section                   | Mechanism                                                                                                                                        | Status     |
| --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `interface` for objects, `type` for unions    | Interfaces, Types, and Schemas  | `typescript/consistent-type-definitions: ["error", "interface"]`                                                                                 | Mechanical |
| All properties `readonly`, `ReadonlyArray<T>` | Interfaces, Types, and Schemas  | `typescript/array-type` with `readonly: "generic"`, `typescript/prefer-readonly`. No Oxlint rule requires `readonly` on every interface property | Partial    |
| Decode external data with `effect/Schema`     | Boundary Validation with Schema | `anti-slop/no-unknown-parameters`, `no-runtime-typeof`, `no-widen-then-assert`                                                                   | Partial    |
| No `unknown` in domain functions              | Linter Rules                    | `anti-slop/no-unknown-parameters`, `no-unknown-returns`, override for boundary files                                                             | Mechanical |
| No chained assertions, `// SAFETY:` comments  | Linter Rules                    | `anti-slop/no-chained-type-assertions`, `require-safety-comment-for-type-assertion`                                                              | Mechanical |
| No type widening                              | Linter Rules                    | `anti-slop/no-known-value-widening`, `no-unsafe-dictionary-type`                                                                                 | Mechanical |
| No speculative fallback                       | Linter Rules                    | `typescript/no-unnecessary-condition` (flags `??` on non-nullable values)                                                                        | Partial    |
| No non-null assertions                        | Vite+ configuration             | `typescript/no-non-null-assertion`                                                                                                               | Mechanical |
| Use `Match`, not `switch (x._tag)`            | Tagged Unions and Match         | `anti-slop-effect/no-manual-tag-comparison`, `prefer-effect-match`                                                                               | Mechanical |

### Errors and Effect Control Flow

| Rule                                       | Guide section               | Mechanism                                                                                                                                                              | Status               |
| ------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Domain errors use `Schema.TaggedError`     | Error Handling              | `anti-slop-effect/no-manual-effect-error-tag`, `no-manual-tagged-construction`                                                                                         | Partial              |
| No `throw` or `try/catch` in domain logic  | Error Handling              | Oxlint has no `no-restricted-syntax`. Proposed: a small vendored rule in `tools/oxlint/house/` that bans `ThrowStatement` and `TryStatement` under `packages/core/src` | Review until written |
| No `Effect.orDie` in domain logic          | Error Handling              | Same house rule, banning the `orDie` member call                                                                                                                       | Review until written |
| Wrap Promise APIs with `Effect.tryPromise` | Error Handling              | `typescript/no-floating-promises`, `no-misused-promises`                                                                                                               | Partial              |
| Exported workflows use `Effect.fn("name")` | Workflows with Effect.fn    | Review                                                                                                                                                                 | Review               |
| Bounded concurrency on collections         | Bounded Concurrency         | Review                                                                                                                                                                 | Review               |
| Immutable array methods (`toSorted`)       | Pure Transforms and Lookups | `unicorn/no-array-sort`, `unicorn/no-array-reverse`                                                                                                                    | Mechanical           |

### Naming, Files, and Documentation

| Rule                                                     | Guide section            | Mechanism                                                                                              | Status     |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------- |
| `kebab-case` file names                                  | Naming Conventions       | `unicorn/filename-case: ["error", { case: "kebabCase" }]`                                              | Mechanical |
| Test files are `*.test.ts`                               | Naming Conventions       | `vitest/consistent-test-filename`                                                                      | Mechanical |
| camelCase, PascalCase, SCREAMING_SNAKE, Boolean prefixes | Naming Conventions       | Oxlint has no `naming-convention` rule. Option: a vendored house rule                                  | Review     |
| One responsibility per file                              | Design Principle 7       | Review                                                                                                 | Review     |
| TSDoc on all exports                                     | Documentation with TSDoc | No Oxlint `require-jsdoc` rule. Option: a house rule, or a CI script over `vp pack` declaration output | Review     |
| Markdown style                                           | Markdown guide           | `rumdl check --deny-config-warnings .`, `vale --no-global .`                                           | Mechanical |

### Tests

| Rule                                          | Guide section                                 | Mechanism                                                                                                                                       | Status      |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `@effect/vitest`, `it.effect` for Effect code | Testing                                       | Dependency, review                                                                                                                              | Partial     |
| No `vi.mock()`                                | Linter Rules                                  | `anti-slop/no-module-mocking`                                                                                                                   | Mechanical  |
| No live network in tests                      | Testing                                       | Tests provide a fixture-backed `HttpClient` layer. Proposed `test.setupFiles` entry that replaces `globalThis.fetch` with a function that fails | Mechanical  |
| Fixtures in `test/fixtures/`                  | Testing                                       | Review                                                                                                                                          | Review      |
| Test names are sentences                      | Testing                                       | `vitest/valid-title` (if present) or review                                                                                                     | Review      |
| Coverage threshold                            | Not in TS guide, Python guide uses 85 percent | `test.coverage.thresholds`                                                                                                                      | Question Q6 |

## Proposed Project Structure

This section proposes the package layout and directory tree.

### Single Package or Workspace

The guide shows one `src/` tree (Project Structure). It does not discuss
workspaces. The `fitzRoy-ts` precedent is one package with an `exports` map and
a `bin` entry.

The deciding constraint is the TUI. A TUI library such as Ink or OpenTUI pulls
in React or a native core. In a single package these become dependencies of
every library consumer. A Bun workspace keeps the library free of them. Vite+
supports workspaces and applies the root `lint` and `fmt` settings to every
package (Vite+ check guide).

Recommendation: a Bun workspace with two published packages. Use one package
only if the user accepts the TUI dependencies in the library install
(Question Q3).

### Directory Tree

```text
abs/
  packages/
    core/                         # Published library; portable; no TUI deps
      src/
        index.ts                  # Public exports only
        types.ts                  # Shared schemas, tagged errors, domain types
        abs/
          time-series.ts          # readabs read_abs: catalogue and series IDs
          time-series-parse.ts    # Pure spreadsheet-to-tidy transforms
          sdmx-api.ts             # readabs read_api: ABS Data API service
          sdmx-parse.ts           # Pure SDMX-JSON or CSV transforms
          lfs.ts                  # Convenience readers such as read_lfs
        rba/
          tables.ts               # readrba read_rba service
          tables-parse.ts         # Pure CSV transforms
          forecasts.ts            # rba_forecasts
          browse.ts               # browse_rba_tables and series
        http/
          client.ts               # HttpClient service with retry Schedule
        cache/
          cache.ts                # Cache service interface
        lib/
          dates.ts                # Period parsing and Australian time zones
      test/
        abs/  rba/  fixtures/
      package.json
      tsconfig.json               # types: []
    cli/                          # Published CLI and TUI
      src/
        main.ts                   # bin entry; runs the program on Node or Bun
        commands/                 # effect/cli commands
        tui/                      # MVU model, update, and view
        layers.ts                 # AppLayer and ManagedRuntime
      test/
      package.json                # bin: { abs: ... }
      tsconfig.json               # types: ["node"]
  tools/
    oxlint/
      anti-slop/                  # Vendored, with effect/ subfolder
      house/                      # Proposed rules: no throw, naming, TSDoc
  styles/                         # Vale House rules and vocabularies
  docs/
    research/
  .github/
    workflows/
      ci.yml
      release.yml
  vite.config.ts                  # Root lint, fmt, test, run configuration
  tsconfig.json                   # Root strict options and references
  tsconfig.node.json              # Tooling files: vite.config.ts, tools/**
  package.json                    # workspaces, packageManager, scripts
  bun.lock
  .rumdl.toml
  .vale.ini
  renovate.json
  CLAUDE.md
  README.md
  CHANGELOG.md
```

Notes on the tree:

- The guide's `db/`, `mcp/`, `worker.ts`, and `alchemy.run.ts` do not apply.
  The project deploys no Cloudflare resources, so Alchemy, Drizzle, and D1 are
  out of scope.
- `types.ts` comes first, per Design Principle 1.
- Each source module owns its service, and a `*-parse.ts` sibling holds the
  pure transforms. This follows Design Principle 3 and the guide's
  `afl-api.ts` and `transforms.ts` split.
- `layers.ts` lives in the CLI because only the CLI picks a platform. The core
  exports services and default layers that need `HttpClient` and `FileSystem`.
  The consumer supplies the platform layers.
- The house rules in `tools/oxlint/house/` are optional. They close the
  `Review` gaps in the rule register.

## Configuration Files

This section gives the key contents of each configuration file.

### Root `package.json`

```json
{
  "name": "abs-workspace",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.4",
  "workspaces": ["packages/*"],
  "engines": { "node": "^22.18.0 || ^24.11.0 || >=26.0.0" },
  "scripts": {
    "check": "vp check",
    "test": "vp test",
    "build": "vp run -r build",
    "docs:check": "rumdl check --deny-config-warnings . && vale --no-global ."
  },
  "devDependencies": {
    "vite-plus": "1.4.0",
    "typescript": "7.0.2",
    "@effect/vitest": "4.0.6",
    "@types/node": "26.x"
  }
}
```

The guide's `dev` and `deploy` scripts do not apply. No deployment exists. The
Node engine range copies the Vite+ 1.4.0 engine range. Confirm the
`vp run -r` syntax against `vp run --help` at setup.

### Root `tsconfig.json`

Copy the guide's compiler options unchanged. Add `erasableSyntaxOnly: true` to
enforce the no-`enum` rule. Add `rewriteRelativeImportExtensions` only if
packages emit with `tsc`. `vp pack` emits through tsdown, so it is not needed.

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "isolatedDeclarations": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/cli" },
    { "path": "./tsconfig.node.json" }
  ],
  "files": []
}
```

Per-package tsconfigs extend the root file. The core sets `"types": []`, which
reproduces the `fitzRoy-ts` portability gate (`tsconfig.portable.json`). The
CLI sets `"types": ["node"]`. `tsconfig.node.json` covers `vite.config.ts` and
`tools/**`, as the guide specifies. TypeScript 7 requires explicit `types`
because the default is `[]`.

### Root `vite.config.ts`

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [".claude/**", "tools/oxlint/anti-slop/**", "**/dist/**"],
    options: { typeAware: true, typeCheck: true, denyWarnings: true },
    jsPlugins: [
      "./tools/oxlint/anti-slop/index.ts",
      "./tools/oxlint/anti-slop/effect/index.ts",
    ],
    rules: {
      // Guide rules, unchanged.
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unnecessary-condition": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      // Proposed additions that enforce other guide rules.
      "typescript/explicit-module-boundary-types": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/consistent-type-definitions": ["error", "interface"],
      "typescript/array-type": ["error", { default: "generic", readonly: "generic" }],
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-array-sort": "error",
      "vitest/consistent-test-filename": "error",
    },
    overrides: [
      {
        files: ["packages/core/src/**"],
        rules: {
          "eslint/no-restricted-globals": ["error", "Bun", "process", "Buffer"],
        },
      },
      {
        files: ["packages/cli/src/main.ts", "**/test/**"],
        rules: { "anti-slop/no-unknown-parameters": "off" },
      },
    ],
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    printWidth: 100,
    ignorePatterns: [".claude/**", "tools/oxlint/anti-slop/**"],
  },
  test: {
    environment: "node",
    setupFiles: ["./tools/test/block-network.ts"],
  },
  staged: { "*": "vp check --fix" },
});
```

Verify each proposed rule option against `vp lint --help` and the Oxlint rule
pages before adoption. The `array-type` option names follow the
typescript-eslint rule that Oxlint ports.

The guide puts `globals: true` in the test block. That conflicts with explicit
imports from `@effect/vitest` in the guide's own test example. Explicit imports
are clearer, so this proposal omits `globals` (Question Q8).

Verify at setup that `@effect/vitest` resolves its bare `vitest` import. Vite+
bundles Vitest 5.0.5, but Bun's install layout decides whether that copy is
visible to other packages. If resolution fails, add `vitest` at exactly
`5.0.5`, matching the bundled version.

### Package Builds

Use `vp pack` (tsdown) in each package. `isolatedDeclarations` lets tsdown emit
declarations without a full type check. The core publishes ESM only, with
`dts: true`. The CLI publishes a `bin` entry. `vp pack` can also build a
standalone executable with `exe: true` on Node 25.7 or later (Vite+ pack guide).
`fitzRoy-ts` uses `bun build --compile` instead (Question Q5).

### Git Hooks

Vite+ provides `vp staged` and `.vite-hooks/pre-commit` through
`vp hooks enable` (Vite+ migration guide). This replaces the Python guide's
`pre-commit` and the `simple-git-hooks` setup in `fitzRoy-ts`.

## Continuous Integration and Release

The TypeScript guide is silent on CI and release. The rules below come from the
infrastructure authoring guide ("Make CI checks prove readiness") and the
`fitzRoy-ts` workflows.

`ci.yml` triggers on `pull_request` and on `push` to `main`. It has one
`Check repository` job with named steps:

1. Check out the repository. Set up Node and Bun at pinned versions.
2. `bun install --frozen-lockfile`.
3. `vp check` (format, lint, and type check).
4. `vp test` with coverage.
5. Build both packages with `vp pack`.
6. `npm pack --dry-run` and `attw --pack` on each package.
7. Run `actionlint` on workflow files.
8. Run `rumdl` and `vale` (a separate job is acceptable if setup differs, as in
   `fitzRoy-ts` `documentation.yml`).

Workflow rules from the authoring guide:

- Pin third-party actions to full commit SHAs.
- Pin the runner image to a release name such as `ubuntu-24.04`.
- Set `timeout-minutes` on every job.
- Do not use `continue-on-error` or `|| true`.
- Set `permissions: contents: read` at the top level.

`release.yml` follows `fitzRoy-ts`:

- Trigger on a `v*` tag.
- Reuse `ci.yml` through `workflow_call`.
- Check that the tag matches each `package.json` version.
- Publish with npm trusted publishing (OIDC, `id-token: write`) and
  `--provenance`.
- Build standalone binaries in a matrix if the user wants them.

Dependency updates: add a `renovate.json` that extends the shared
`renovate-config` preset. The `abs` repository is not yet in the preset's
automerge list. Adding it is a change to the `renovate-config` repository.

## Open Questions

- Q1. Effect version. `@effect/vitest@4` under Vite+ 1.4 requires Effect 4,
  and so does Foldkit. The guide's examples use Effect 3 names. Should the
  project adopt Effect 4, and should the user update the guide to match?
- Q2. TUI library. Foldkit is the guide's secondary UI framework, but it is
  browser-only (`@effect/platform-browser` peer dependency). Candidates are Ink
  8 (React, Node 22 or later) and OpenTUI 0.7 (native Zig core, Bun 1.3.14 or
  later, or Node 26.4 or later). Neither appears in the guide. Should the TUI
  keep a Foldkit-style Model-View-Update structure on the chosen renderer?
  That structure has a `Schema.Struct` Model, a `Message` tagged union, and a
  pure `update` function.
- Q3. Package split. Is a two-package Bun workspace acceptable, or must the
  project keep the guide's single `src/` layout?
- Q4. Anti-slop scope. Enable only the guide's 7 rules, or all 23 upstream
  rules as the upstream README recommends?
- Q5. CLI runtime and distribution. Publish to npm for Node, ship Bun-compiled
  binaries, use `vp pack --exe`, or several of these? The guide calls Bun a
  local script runtime only.
- Q6. Coverage threshold. The TypeScript guide is silent. The Python guide uses
  85 percent overall and 90 percent for transforms. Should the same numbers
  apply?
- Q7. Dependencies. ABS time series come as Excel files. The project needs a
  spreadsheet parser, which tests Design Principle 6. The `xlsx` package on
  npm is stale at 0.18.5 because SheetJS moved distribution to its own CDN.
  Which parser, or a minimal in-house reader built on a ZIP and XML library,
  is acceptable?
- Q8. Guide corrections. Should findings F1 to F8 go back into the published
  guide, so later projects copy correct configuration?
- Q9. House lint rules. Should the project vendor its own Oxlint rules for
  naming, TSDoc coverage, and no `throw` in domain code? They would close the
  `Review` gaps but add maintained code.
- Q10. `erasableSyntaxOnly`. This flag also bans parameter properties. The
  guide's naming table shows `private readonly client`, which could be written
  as a parameter property. Is the ban acceptable?
- Q11. Versioning and changelog. The guide is silent. `fitzRoy-ts` uses manual
  tags and a hand-written `CHANGELOG.md`. Should this project use Changesets or
  another tool for two packages, or keep the manual process?

## References

- [TypeScript style guide](https://jackemcpherson.com/docs/typescript-style-guide.md)
- [Markdown style guide](https://jackemcpherson.com/docs/markdown-style-guide.md)
- [Infrastructure authoring guide](https://jackemcpherson.com/docs/infrastructure-authoring-guide.md)
- [Python style guide](https://jackemcpherson.com/docs/python-style-guide.md)
- [Vite+ check guide](https://viteplus.dev/guide/check)
- [Vite+ test guide](https://viteplus.dev/guide/test)
- [Vite+ pack guide](https://viteplus.dev/guide/pack)
- [Vite+ migration guide](https://viteplus.dev/guide/migrate)
- [Oxlint rules](https://oxc.rs/docs/guide/usage/linter/rules.html)
- [Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
- [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop)
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [Effect documentation](https://effect.website/docs/)
- [npm registry: effect](https://www.npmjs.com/package/effect)
- [npm registry: @effect/vitest](https://www.npmjs.com/package/@effect/vitest)
- [npm registry: vitest-environment-miniflare](https://www.npmjs.com/package/vitest-environment-miniflare)
- [Foldkit](https://foldkit.dev/)
- [Ink](https://github.com/vadimdemedes/ink)
- [OpenTUI](https://github.com/sst/opentui)
- [readabs](https://github.com/MattCowgill/readabs)
- [readrba](https://github.com/MattCowgill/readrba)
- [actionlint](https://github.com/rhysd/actionlint)
