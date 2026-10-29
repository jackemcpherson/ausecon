# `ausecon`

`ausecon` reads Australian economic data from the Australian Bureau of
Statistics (ABS) and the Reserve Bank of Australia (RBA). It provides a
TypeScript library and a command-line tool.

The `readabs` and `readrba` R packages inspired the project and set its
coverage benchmark.

---

## Status

Version 0.3.0 reads ABS time series by catalogue number and table number,
and current RBA statistical tables by RBA table number. It reads series IDs
from both publishers in one call, and searches a series index of RBA series
offline. Source: Reserve Bank of Australia. The RBA does not endorse this
project.

- [`@ausecon/core`](packages/core/README.md): the TypeScript library.
- [`ausecon`](packages/cli/README.md): the command-line tool.

## Development

Install the dependencies with Bun, then run the checks:

```shell
bun install
bun run check
bun run typecheck
bun run test
bun run build
```

The `GLOSSARY.md` file defines the domain terms. The `docs/adr/` directory
records the architecture decisions.

## References

- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)
