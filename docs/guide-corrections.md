# TypeScript Guide Corrections

This file lists faults in the published TypeScript style guide that `ausecon`
found when it applied the guide with current tool releases. Fix each item in
the guide after `ausecon` v0.1.0 proves the correction.

---

## Configuration Faults

- F1: The sample `vite.config.ts` sets only `lint.options.typeAware`. The
  `vp check` command runs the type checker only when `typeCheck: true` is also
  set.
- F2: The sample `fmt` block uses Biome option names. Oxfmt uses `useTabs`,
  `tabWidth`, and `printWidth`.
- F3: The sample imports `defineConfig` from `vite`. Import it from
  `vite-plus`.
- F4: The examples use Effect 3 names. Effect 4 is current, and the guide's
  own test tools require it. See `docs/adr/0002-effect-4.md`.
- F5: TypeScript 7 is stable, and its binary is `tsc`. The `types` option
  defaults to an empty list, so each tsconfig must list its ambient types.
- F6: Miniflare no longer supports the `miniflare` test environment. Use the
  runtime that the project targets.
- F7: The `vp test` command runs once. The `--run` flag is redundant.
- F8: The anti-slop install command changed, and upstream now has 23 rules.

## Faults Found During Setup

- F9: The guide enables `isolatedDeclarations`, but its own
  `Schema.TaggedError` and `Schema` examples fail with that flag (TS9021 and
  TS9010). The flag also requires `declaration` or `composite`. Remove the
  flag, and rely on `typescript/explicit-module-boundary-types` for return
  types. See `docs/adr/0004-no-isolated-declarations.md`.
- F10: The `@effect/vitest` package imports its own `vitest` copy. Add the
  Vite+ `overrides` for `vite` and `vitest`, or tests fail with a runner state
  error.
- F11: The `vp check` type check does not report every compiler diagnostic. It
  missed the TS9010 and TS5097 errors that `tsc` reports. Add a `typecheck`
  script that runs `tsc` for each tsconfig, and run it in CI.
- F12: The Effect 4 command-line module is `effect/cli`, not
  `effect/unstable/cli`. Its declarations carry an unstable tag, so pin Effect
  to an exact version.
- F13: Oxfmt formats Markdown and YAML by default. Add `**/*.md` to
  `fmt.ignorePatterns`, because the Markdown guide makes `rumdl` the only
  Markdown formatter.
- F14: The guide's tooling tsconfig must set `allowImportingTsExtensions`.
  The vendored anti-slop plugins import files with a `.ts` extension.
