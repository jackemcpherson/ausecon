# ausecon

TypeScript port of the readabs and readrba R packages. Reference implementation
of Jack's TypeScript standards: follow them strictly.

## Read First

- `GLOSSARY.md`: domain terms. Use them exactly in code, commands, and docs.
- `docs/adr/`: decisions that override the style guide. Do not undo them.
- `docs/guide-corrections.md`: known faults in the style guide. Record new
  ones here.
- `docs/research/`: background research for v0.1.0.

## Layout

- `packages/core` (`@ausecon/core`): data library. Runs on any runtime. No
  Node, Bun, or terminal APIs (`types: []`, lint bans `process`, `Bun`,
  `Buffer`). No `throw`, `try`, or `Effect.orDie` in `src/`.
- `packages/cli` (`ausecon`): command-line tool on `effect/cli`.
- `tools/oxlint/anti-slop`: vendored, do not edit. See `UPSTREAM.md`.
- `tools/oxlint/house`: project lint rules.

## Commands

Run all of these before committing:

```shell
bun run check       # vp check: format, lint, type-aware rules
bun run typecheck   # tsc for every project; catches what vp check misses
bun run test        # unit tests; network is blocked
bun run build       # vp pack for both packages
bun run docs:check  # rumdl and Vale
```

The pre-commit hook in `.vite-hooks/pre-commit` runs `vp staged`. Do not set a
local `core.hooksPath`: it would bypass the global gitleaks hook. Instead, run
`GIT_CONFIG_GLOBAL=/dev/null vp hooks enable`, then
`git config --local --unset core.hooksPath`, and make `.git/hooks/pre-commit`
exec `.vite-hooks/_/pre-commit`. The global hook calls it after its scan.

Run `bun run test --coverage` to apply the coverage thresholds (85 percent
overall, 90 percent for `*-parse.ts`). Set `AUSECON_LIVE=1` to add the live
ABS test project.

## Rules

- Pin every dependency exactly. Effect and `effect/cli` are pinned because the
  CLI module is unstable.
- Unit tests use recorded fixtures in `packages/*/test/fixtures/`.
- Import from `vite-plus/test` in setup files and `@effect/vitest` in tests.

## Agent skills

### Issue tracker

GitHub Issues in `jackemcpherson/ausecon`, through `gh`. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`. See
`docs/agents/domain.md`.
