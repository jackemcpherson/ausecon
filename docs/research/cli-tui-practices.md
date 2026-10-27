# CLI and TUI Practices

This note compares tools and practices for a TypeScript port of Matt
Cowgill's `readabs` and `readrba` R packages as a data library, a CLI, and a
terminal user interface (TUI). Versions, stars, and download counts are a
snapshot from 2026-10-27; a bare "(npm registry)" cites the
[npm registry][npm-registry] package metadata read with `npm view`.

---

## Summary of Recommendations

| Concern | Recommendation | Main alternative |
| --- | --- | --- |
| Library shape | Pure ESM data library with no terminal dependencies | None |
| Argument parsing | `effect/unstable/cli` if the library uses Effect | `citty` or `commander` 15 |
| Prompts and spinners | `@clack/prompts` 1.x | `@inquirer/prompts` |
| Full-screen browser | Ink 8 on Node 22+ | OpenTUI on Bun or Node 26.4+ |
| Colour | `node:util` `styleText` | `picocolors` or `ansis` |
| Sparklines and charts | Hand-written block-character sparkline | `asciichart` |
| Config and cache paths | `env-paths` with `suffix: ''`, or explicit XDG | Hand-written XDG |
| Shell completions | Framework built-in, else `@bomb.sh/tab` | None |
| Bundling | `vp pack` (tsdown) | `tsdown` directly |
| Single binary | `bun build --compile` | Node SEA via `vp pack` `exe` |
| Tests | Vitest, `ink-testing-library`, `execa`, `node-pty` | None |

The sections below give the evidence and the tradeoffs.

## Library and CLI Split

Keep the data library free of terminal code.
The library returns typed data (series, catalogue entries, observations) and
reports progress through callbacks or an `AbortSignal`, never through a spinner.
The CLI and the TUI are thin layers that format library results.

Use package `exports` to publish the library entry point and `bin` to publish
the command. Node treats `exports` as the only public entry points and supports
subpath exports such as `./rba`
([Node packages: subpath exports][node-exports]).
npm links each `bin` entry onto the user's `PATH`
([npm package.json `bin`][npm-bin]).

A minimal layout:

```text
src/
  lib/            # fetch, parse, cache; no terminal dependencies
    abs/
    rba/
  cli/            # argument parsing, output formatting, exit codes
    commands/     # one lazily imported module per subcommand
  tui/            # Ink or OpenTUI components; imported only by `browse`
```

```json
{
  "type": "module",
  "exports": {
    ".": "./dist/lib/index.js",
    "./abs": "./dist/lib/abs/index.js",
    "./rba": "./dist/lib/rba/index.js"
  },
  "bin": { "auseconomy": "./dist/cli/index.js" }
}
```

Load the TUI and its React dependency with a dynamic `import()` inside the
`browse` command only. This keeps library users free of React and keeps
`--help` fast. clig.dev asks a CLI to "Print something to the user in <100ms"
([clig.dev][clig]). `citty` documents lazy subcommands for this reason
([citty README][citty]), and `gunshi` lists lazy loading as a feature
([gunshi README][gunshi]).

## Argument Parsing and Command Frameworks

| Package | Version | Last publish | Weekly downloads | Stars |
| --- | --- | --- | --- | --- |
| `commander` | 15.0.0 | 2026-09 | 432M | 28.4k |
| `yargs` | 18.2.0 | 2026-09 | 213M | 11.5k |
| `cac` | 7.1.0 | 2026-10 | 37M | 3.1k |
| `citty` | 0.2.2 | 2026-08 | 23M | 1.3k |
| `@oclif/core` | 5.1.9 | 2026-10 | 8.3M | 318 |
| `clipanion` | 4.0.0-rc.4 | 2024-09 | 4.5M | 1.3k |
| `@stricli/core` | 1.3.0 | 2026-07 | 429k | 1.1k |
| `cleye` | 2.7.0 | 2026-09 | 401k | 694 |
| `gunshi` | 0.37.3 | 2026-10 | 37k | 476 |
| `effect/unstable/cli` | `effect` 4.0.6 | 2026-10 | n/a | n/a |

Sources: npm registry metadata and the [npm downloads API][npm-dl], GitHub
repository API.

Findings:

- `commander` 15 is ESM-only and requires Node 22.12 or later
  ([commander changelog][commander-cl]). Strong typing of parsed options needs
  the companion `@commander-js/extra-typings` package, which is at 15.0.0
  (npm registry). It has the most mature help output and the largest user base.
- `yargs` 18 requires Node 20.19 or 22.12+ (npm registry). Wrangler uses
  `yargs` 17 (npm registry, `wrangler` dependencies).
- `citty` has zero dependencies and is built on `util.parseArgs`. It supports
  typed `positional`, `string`, `boolean`, and `enum` arguments, nested and
  lazy subcommands, and generated usage text ([citty README][citty]).
- `@stricli/core` (Bloomberg) treats each command as a function whose
  signature drives parsing ([Stricli principles][stricli-principles]). Its
  isolated context injects `stdout` and `stderr`, so tests do not patch globals
  ([Stricli isolated context][stricli-context]). Its completion support is
  bash-only at present ([Stricli autocomplete][stricli-complete]).
- `gunshi` offers declarative typed arguments, lazy subcommands, plugins, and
  i18n, and runs on Node, Deno, and Bun ([gunshi README][gunshi]). Its user
  base is small.
- `clipanion` has not published a stable release since 4.0.0-rc.4 in 2024
  (npm registry). Do not choose it for a new project.
- `@oclif/core` is a plugin-oriented framework for large CLIs. It adds more
  structure than this project needs.
- `node:util` `parseArgs` is stable since Node 20 and supports only `string`
  and `boolean` options, with no subcommands or help generation
  ([Node util.parseArgs][node-parseargs]).
- Effect 4 is stable at 4.0.6 (npm registry, [Effect releases][effect-rel]).
  Its CLI lives at `effect/unstable/cli` with `Command`, `Flag`, `Argument`,
  `Prompt`, `HelpDoc`, and `Completions` modules
  ([effect-smol source tree][effect-cli-src]). `Completions` generates bash,
  zsh, and fish scripts and backs a built-in completions flag
  ([Completions.ts][effect-completions]). The `unstable` path means the API can
  change in minor releases. The standalone `@effect/cli` package (0.77.2) is
  the Effect 3 line.

Recommendation: if the library uses Effect, which Jack's TypeScript standard
sets as the default, use `effect/unstable/cli`. Typed errors from the library
then map directly to exit codes and hint messages, and completions come built
in. Pin the `effect` version because of the `unstable` path. If the library
does not use Effect, use `citty` for a small dependency footprint or
`commander` 15 with `extra-typings` for the most established help output.

## Interactive Prompts and TUI Frameworks

### Prompt Libraries

`@clack/prompts` 1.8.1 provides `text`, `select`, `multiselect`,
`autocomplete`, `autocompleteMultiselect`, `path`, `date`, `confirm`, `group`,
`tasks`, `spinner`, `progress`, `taskLog`, `log`, `stream`, `note`, and `box`.
Every prompt accepts an `AbortSignal`, and `isCancel()` detects Ctrl-C
([clack prompts reference][clack-docs]). It requires Node 20.12+ and has 14M
weekly downloads (npm registry). Its `autocomplete` prompt fits a series search,
and `progress` fits multi-file downloads.

If the CLI uses `effect/unstable/cli`, evaluate its `Prompt` module
([Effect CLI source tree][effect-cli-src]) before adding clack. This research
did not inspect that module's prompt types.

`@inquirer/prompts` 8.7.4 is the established alternative with 29M weekly
downloads (npm registry). Vercel CLI uses individual `@inquirer/*` packages
(npm registry, `vercel` dependencies).

Recommendation: use `@clack/prompts` for one-shot interactive flows, such as
choosing a table when the user omits an argument. Its default visual style
is consistent, and it includes spinner and progress components.

### Full-Screen TUI Frameworks

Ink 8.0.0 (2026-10-03) requires Node 22 and React 19.3+. Version 8 added
scroll offsets on `<Box>`, incremental rendering that skips unchanged line
prefixes, screen-reader output fixes, and `render()` support for any Node
stream ([Ink releases][ink-releases]). Version 7 added `alternateScreen`,
`usePaste`, `useWindowSize`, and Kitty keyboard support
([Ink releases][ink-releases]). Ink has basic screen-reader support through
`INK_SCREEN_READER=true` ([Ink README][ink]). On CI, detected via the `CI`
variable, Ink renders only the last frame ([Ink README][ink]). Users include
Claude Code, Gemini CLI, GitHub Copilot CLI, Shopify CLI, Prisma, and Wrangler
([Ink README][ink]). It has 4.0M weekly downloads and 40k stars.

The Ink component ecosystem is stale. `@inkjs/ui` 2.0.0, `ink-spinner`,
`ink-text-input`, and `ink-testing-library` last published in 2024, and
`ink-table` in 2023 (npm registry). Their peer ranges (`ink >=5`) allow Ink 8,
but no release confirms compatibility with Ink 8 and React 19.3. Plan to write
the list, table, search box, and sparkline components directly on Ink's `Box`
and `Text`.

OpenTUI 0.7.0 has a native Zig core with React and Solid bindings, flexbox
layout, and mouse support ([OpenTUI README][opentui]). OpenCode uses it in
production ([OpenTUI README][opentui]). `@opentui/core` requires Bun 1.3.14+
or Node 26.4+ with ESM, and ships per-platform native binaries as optional
dependencies (npm registry). It is pre-1.0 and has 327k weekly downloads.

`blessed` has had no commits since 2024-03 and `neo-blessed` last published in
2022 (GitHub API, npm registry). `terminal-kit` is maintained but has no
component model. Do not use either for new work.

Tradeoffs of React in the terminal:

- Ink gives a familiar component model, flexbox via Yoga, and the largest set
  of production users.
- React adds dependency weight and startup cost. Lazy-load it so that
  non-interactive commands do not pay for it.
- Ink re-renders whole frames. Version 8 incremental rendering reduces
  flicker ([Ink releases][ink-releases]), but large scrolling tables still need
  windowing in application code.
- OpenTUI renders natively and handles large outputs better, but it ties the
  project to Bun or Node 26.4+ and to a pre-1.0 API.

Recommendation: Ink 8 for an `abs browse` screen if the CLI targets Node 22
and 24 LTS users through `npx`. Choose OpenTUI only if the project commits to
Bun or Node 26+. Keep all non-browse commands free of both.

This research did not verify Ink 8 on Bun. The Ink README does not mention Bun
([Ink README][ink]), and Bun documents its Node compatibility separately
([Bun Node.js compatibility][bun-node]). Test `abs browse` under Bun before
promising Bun support.

## Styling and Output

| Package | Version | Weekly downloads | Notes |
| --- | --- | --- | --- |
| `node:util` `styleText` | Node built-in | n/a | Stable since 22.13 and 23.5 |
| `picocolors` | 1.1.1 | 197M | Last publish 2024-10 |
| `chalk` | 6.0.1 | 435M | Node 22+ |
| `ansis` | 4.4.0 | 40M | Truecolor and hex support |
| `ora` | 9.4.1 | 75M | Spinner |
| `listr2` | 11.4.0 | 41M | Concurrent task lists |
| `boxen` | 9.0.0 | n/a | Node 22+ |
| `cli-table3` | 0.6.5 | n/a | Last publish 2024-05 |
| `asciichart` | 1.5.25 | 91k | Last publish 2022-06 |
| `simple-ascii-chart` | 6.0.0 | 950 | Active, small user base |

`util.styleText(format, text, options)` checks the target stream for TTY
support and respects `NO_COLOR`, `NODE_DISABLE_COLORS`, and `FORCE_COLOR`
since Node 22.8. It became stable in Node 22.13 and 23.5, and accepts hex
colours since Node 24.16 and 26.1 ([Node util.styleText][node-styletext]).
Pass `{ stream: process.stderr }` when styling text written to stderr.

Recommendation:

- Use `styleText` for colour. It removes a dependency and implements the
  colour rules in the UX section. Use `ansis` if the project needs a chainable
  API or must support runtimes where `styleText` is absent.
- Use the clack `spinner`, `progress`, and `taskLog` components on stderr for
  downloads. Use `listr2` only if downloads run concurrently with per-task
  status lines.
- Write a sparkline function with the eight Unicode block characters. It is
  about ten lines and needs no dependency. Use `asciichart` for a full line
  chart in `abs show --chart`; it is unmaintained but small and stable.
- Format tables with `string-width` (8.3.0, active) for column alignment, or
  with Ink `Box` layout inside the TUI.

## UX Principles

The following rules come from [clig.dev][clig] unless another source is named.

### Streams and Exit Codes

- Write data (CSV, JSON, table rows) to stdout. Write spinners, progress,
  logs, and errors to stderr, so `abs get ... > file.csv` produces a clean file.
- Return 0 on success and non-zero on failure. Map distinct non-zero codes to
  the main failure modes, such as usage error, network error, and series not
  found.

### Machine-Readable Output

- Support `--json` for structured output and `--plain` or CSV for one record
  per line.
- GitHub CLI pairs `--json <fields>` with `--jq` and `--template`, and
  pretty-prints JSON only when stdout is a terminal
  ([gh formatting manual][gh-format]). A `--json` flag with a field list fits
  catalogue queries in this project.
- Start Ink only when stdin and stdout are TTYs and no machine-output flag is
  set. Ink 8 `render()` accepts any Node stream
  ([Ink releases][ink-releases]), so it can draw on stderr if required.

### TTY Detection and Colour

- Check stdout and stderr separately with `isTTY`.
- Disable colour when the stream is not a TTY, when `NO_COLOR` is set and
  non-empty, when `TERM=dumb`, or when `--no-color` is passed.
- The NO_COLOR standard says user config and command-line flags override the
  variable ([no-color.org][no-color]).
- Do not animate when stdout is not a TTY.

### Interactivity

- Prompt only when stdin is a TTY.
- Provide a flag or argument for every prompt. Support `--no-input` and fail
  with a message that names the missing flag.
- Keep Ctrl-C working during network I/O. Pass an `AbortSignal` from the CLI
  into the library so a cancelled download stops cleanly.

### Help and Errors

- Show concise help when required arguments are missing, with one or two
  examples. Lead full help with examples.
- Suggest the closest command or series ID on a typo, but do not run it.
- Rewrite errors for humans and add a next step. For example, report that the
  ABS returned HTTP 404 for a catalogue number and suggest `abs search`.
- Put the most important information last and use red sparingly.

### Config, Cache, and Updates

- Apply config precedence: flags, environment variables, project config,
  user config, system config.
- Follow the XDG Base Directory specification
  ([XDG Base Directory][xdg]).
- `env-paths` returns platform paths, but on macOS it returns
  `~/Library/Caches` and `~/Library/Preferences` rather than XDG paths. It
  appends a `-nodejs` suffix by default; pass `{ suffix: '' }` to remove it
  ([env-paths README][env-paths]).
- Store downloaded ABS and RBA files in the cache directory so repeated
  queries are fast and work offline.
- Do not send telemetry without consent, and never make a blocking network
  call to an analytics service. `update-notifier` last published in 2024-12
  (npm registry). If the project adds an update notice, run the check in the
  background, cache the result, and skip it when not on a TTY or when `CI` is
  set.

### Subcommands

- Use consistent verb and noun names and the same flag names across
  subcommands. Avoid a catch-all default subcommand.

### Shell Completions

`@bomb.sh/tab` 0.0.22 generates zsh, bash, fish, and PowerShell completions,
has adapters for `cac`, `citty`, and `commander`, and lists Cloudflare, Nuxt,
Prisma, Astro, and Vitest as adopters ([tab README][tab]). It is pre-1.0. If
the project uses `effect/unstable/cli`, use its built-in completions instead
([Completions.ts][effect-completions]).

### Windows

- Ink 7.0.6 fixed stale frames on Windows ([Ink releases][ink-releases]).
- OpenTUI ships `win32-x64` and `win32-arm64` native packages (npm registry).
- Use `node:path` and `env-paths` for all file paths, and test the CLI on a
  Windows runner in CI.

## Packaging and Distribution

### Runtime Support

Node release status on 2026-10-28: Node 26 becomes Active LTS, Node 24 is in
Maintenance LTS since 2026-10-20, and Node 22 is in Maintenance LTS until
2027-04-30 ([Node release schedule][node-release]). Most current packages in
this note require Node 22 or later (npm registry `engines` fields).

Recommendation: target Node 22.12+ for the npm package, which matches
`commander` 15, Ink 8, and `chalk` 6. This range excludes OpenTUI, which needs
Node 26.4+.

### Bundling

The `tsup` README says the project "is not actively maintained anymore" and
recommends `tsdown` ([tsup README][tsup]). `tsdown` 0.23.2 is built on
Rolldown (npm registry). Jack's TypeScript standard uses Vite+, whose
`vp pack` command wraps tsdown, generates declaration files, and reads its
settings from the `pack` block of `vite.config.ts` ([Vite+ pack][vp-pack]).
Use `vp pack` for both the library and the CLI entry points.

### Single-File Binaries

| Tool | Status | Notes |
| --- | --- | --- |
| `bun build --compile` | Mature | Cross-compiles to Linux, macOS, and Windows; `--bytecode` speeds startup |
| Node SEA (`node --build-sea`) | Stability 1.1 | Needs Node 25.5+; macOS CI-tested on arm64 only |
| `vp pack` with `exe: true` | Experimental | Uses Node SEA; needs Node 25.7+ |
| `deno compile` | Mature | Cross-compiles; embeds `node_modules` unless `--bundle` is used |

Sources: [Bun executables][bun-compile], [Node SEA][node-sea],
[Vite+ pack][vp-pack], [deno compile][deno-compile].

Bun reports that profile-guided bytecode ordering cut one large CLI's cold
start from 1.0 s to 0.53 s ([Bun executables][bun-compile]). Node SEA requires
bundling to one file or the experimental VFS, and cannot load native addons
from the VFS directly ([Node SEA][node-sea]). OpenTUI depends on native
binaries, so it adds risk to SEA builds.

Recommendation: publish to npm first for `npx` and `bunx` use. Add binaries
with `bun build --compile` only if users without Node are a target audience.

## Testing CLIs and TUIs

- Unit-test the library with Vitest and recorded ABS and RBA fixtures.
- Test command handlers in process by injecting `stdout` and `stderr`.
  Stricli's isolated context documents this pattern
  ([Stricli isolated context][stricli-context]); the same design works with
  any framework if handlers receive streams as arguments.
- Test Ink components with `ink-testing-library`, which exposes `lastFrame()`
  ([Ink README: Testing][ink]). Its last release was in 2024 (npm registry), so
  confirm it works with Ink 8 before relying on it.
- Run end-to-end tests against the built binary with `execa` 10.2.1 (npm
  registry). Assert on stdout, stderr, and exit code with `NO_COLOR=1` set.
- For TTY-only behaviour, spawn the CLI in a pseudo-terminal with `node-pty`
  1.1.0 and feed the output to `@xterm/headless` 6.0.0 to get a screen buffer
  for snapshots (npm registry; [node-pty README][node-pty]). Ink uses
  `node-pty` in its own development dependencies (Ink `package.json`).

## Exemplar CLIs

| CLI | Stack (from published dependencies) | Practice to copy |
| --- | --- | --- |
| GitHub CLI (`gh`) | Go | `--json` field lists, `--jq`, TTY-aware output |
| Wrangler | `yargs`, `chalk`, `cli-table3`; listed as an Ink user | Rich help, readable tables |
| Vercel CLI | `arg`, `@inquirer/*`, `ora`, `chalk` | Guided prompts with flag equivalents |
| `create-astro` | `arg` | Fast, single-purpose interactive flow |
| Claude Code, Gemini CLI | Ink (per Ink README) | Full-screen React TUI on Node |
| OpenCode | OpenTUI, native per-platform packages | Native-speed TUI |

Sources: npm registry `dependencies` for `wrangler`, `vercel`, `create-astro`,
and `opencode-ai`; [Ink README][ink]; [OpenTUI README][opentui];
[gh formatting manual][gh-format]. Turborepo is excluded because its CLI is
written in Rust ([Turborepo repository][turbo]).

## Decisions Required

1. Choose the runtime target. Node 22+ through npm supports Ink and the widest
   audience. Bun-first, or Node 26+ only, makes OpenTUI available.
2. Decide whether the library uses Effect. Effect makes `effect/unstable/cli`
   the matching CLI layer but exposes Effect types to library users unless the
   public API wraps them in Promises.
3. Decide the weight of the interactive mode. If `browse` is a secondary
   feature, `@clack/prompts` autocomplete may be enough and Ink can wait. If
   browsing is the main experience, plan for Ink or OpenTUI and custom
   components.
4. Choose config and cache paths on macOS: `env-paths` platform paths or XDG
   paths under `~/.config` and `~/.cache`.
5. Decide whether to ship single-file binaries in addition to the npm package.
6. Choose the command name and noun-verb structure, for example
   `abs search`, `abs get`, `rba get`, and `abs browse`.

## References

- [clig.dev: Command Line Interface Guidelines][clig]
- [no-color.org][no-color]
- [XDG Base Directory specification][xdg]
- [Node.js packages: subpath exports][node-exports]
- [npm package.json `bin`][npm-bin]
- [Node.js `util.parseArgs`][node-parseargs]
- [Node.js `util.styleText`][node-styletext]
- [Node.js single executable applications][node-sea]
- [Node.js release schedule][node-release]
- [commander changelog][commander-cl]
- [citty README][citty]
- [gunshi README][gunshi]
- [Stricli principles][stricli-principles]
- [Stricli isolated context][stricli-context]
- [Stricli shell autocomplete][stricli-complete]
- [Effect releases][effect-rel]
- [Effect CLI source tree][effect-cli-src]
- [Effect CLI Completions.ts][effect-completions]
- [Clack prompts reference][clack-docs]
- [Ink README][ink]
- [Ink releases][ink-releases]
- [OpenTUI README][opentui]
- [env-paths README][env-paths]
- [tab README][tab]
- [GitHub CLI formatting manual][gh-format]
- [tsup README][tsup]
- [Vite+ pack guide][vp-pack]
- [Bun single-file executables][bun-compile]
- [deno compile reference][deno-compile]
- [node-pty README][node-pty]
- [npm downloads API][npm-dl]
- [npm registry][npm-registry]
- [Bun Node.js compatibility][bun-node]
- [Turborepo repository][turbo]

[clig]: https://clig.dev/
[no-color]: https://no-color.org/
[xdg]: https://specifications.freedesktop.org/basedir-spec/latest/
[node-exports]: https://nodejs.org/api/packages.html#subpath-exports
[npm-bin]: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin
[node-parseargs]: https://nodejs.org/api/util.html#utilparseargsconfig
[node-styletext]: https://nodejs.org/api/util.html#utilstyletextformat-text-options
[node-sea]: https://nodejs.org/api/single-executable-applications.html
[node-release]: https://github.com/nodejs/Release
[commander-cl]: https://github.com/tj/commander.js/blob/master/CHANGELOG.md
[citty]: https://github.com/unjs/citty
[gunshi]: https://github.com/kazupon/gunshi
[stricli-principles]: https://bloomberg.github.io/stricli/docs/getting-started/principles
[stricli-context]: https://bloomberg.github.io/stricli/docs/features/isolated-context
[stricli-complete]: https://bloomberg.github.io/stricli/docs/features/shell-autocomplete
[effect-rel]: https://github.com/Effect-TS/effect/releases
[effect-cli-src]: https://github.com/Effect-TS/effect-smol/tree/main/packages/effect/src/unstable/cli
[effect-completions]: https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/src/unstable/cli/Completions.ts
[clack-docs]: https://bomb.sh/docs/clack/packages/prompts/
[ink]: https://github.com/vadimdemedes/ink
[ink-releases]: https://github.com/vadimdemedes/ink/releases
[opentui]: https://github.com/anomalyco/opentui
[env-paths]: https://github.com/sindresorhus/env-paths
[tab]: https://github.com/bombshell-dev/tab
[gh-format]: https://cli.github.com/manual/gh_help_formatting
[tsup]: https://github.com/egoist/tsup
[vp-pack]: https://viteplus.dev/guide/pack
[bun-compile]: https://bun.com/docs/bundler/executables
[deno-compile]: https://docs.deno.com/runtime/reference/cli/compile/
[node-pty]: https://github.com/microsoft/node-pty
[npm-dl]: https://github.com/npm/registry/blob/main/docs/download-counts.md
[npm-registry]: https://www.npmjs.com/
[bun-node]: https://bun.com/docs/runtime/nodejs-compat
[turbo]: https://github.com/vercel/turborepo
