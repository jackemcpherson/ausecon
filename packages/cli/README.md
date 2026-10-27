# `ausecon`

`ausecon` is a command-line tool that reads Australian economic data from the
Australian Bureau of Statistics (ABS) and the Reserve Bank of Australia (RBA).
It ports the `readabs` and `readrba` R packages and uses
[`@ausecon/core`](https://www.npmjs.com/package/@ausecon/core).

---

## Install

The tool needs Node 22.18 or later.

```shell
npm install --global ausecon
ausecon --help
```

## Read ABS Time Series

`ausecon abs get` reads ABS time series from the latest release and writes
the observations to stdout as CSV. Messages and errors go to stderr, so you
can redirect the data to a file.

Save every table of the Wage Price Index:

```shell
ausecon abs get --catalogue 6345.0 > wages.csv
```

Read only tables 1 and 12 of the Labour Force release. Large catalogue
numbers such as 6202.0 have many tables, so pass table numbers:

```shell
ausecon abs get --catalogue 6202.0 --table 1 --table 12
```

Read a watch list of series IDs from any catalogue numbers:

```shell
ausecon abs get --series A2603039T --series A2454446F
```

CSV has one row per observation, with the 12 `readabs` columns. JSON is a
list of series, each with its metadata, its table, and its observations as
`date` and `value` pairs. `--no-metadata` writes only series ID, date, and
value as CSV, and only the series ID and observations of each series as JSON:

```shell
ausecon abs get --catalogue 6345.0 --format json --no-metadata
```

Pass exactly one of `--catalogue` or `--series`. `--table` needs
`--catalogue`. Run `ausecon abs get --help` for every flag.

## Exit Codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| 0    | The read succeeded.                                                          |
| 1    | A fault to report, such as a Time Series Directory error or a layout change. |
| 2    | A usage error, such as a missing flag or an invalid value.                   |
| 3    | No such catalogue number, table number, or series ID.                        |
| 4    | The ABS gave no response, or answered with a status outside 2xx.             |

## Shell Completions

`ausecon --completions <shell>` prints a completion script for `bash`, `zsh`,
`fish`, `sh`, `powershell`, or `pwsh`.

## Links

- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [Changelog](https://github.com/jackemcpherson/ausecon/blob/main/CHANGELOG.md)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
