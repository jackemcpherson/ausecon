# `ausecon`

`ausecon` reads Australian economic data from the Australian Bureau of
Statistics (ABS) and the Reserve Bank of Australia (RBA). It provides a
TypeScript library and a command-line tool.

The project ports the `readabs` and `readrba` R packages to TypeScript.

---

## Status

Version 0.1.0 reads ABS time series by catalogue number and table number, or
by series ID. RBA data comes in a later release.

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
