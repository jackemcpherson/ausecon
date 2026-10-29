# `ausecon`

`ausecon` is a command-line tool that reads Australian economic data from the
Australian Bureau of Statistics (ABS) and the Reserve Bank of Australia (RBA).
It takes its coverage from the `readabs` and `readrba` R packages and uses
[`@ausecon/core`](https://www.npmjs.com/package/@ausecon/core).

---

## Install

The tool needs Node 22.18 or later.

```shell
npm install --global ausecon
ausecon --help
```

Every command writes data to stdout and messages and errors to stderr, so
you can redirect the data to a file. Run `ausecon <command> --help` for every
flag and more examples.

## Read Series IDs from Both Publishers

`ausecon get` reads series IDs from the ABS and the RBA in one call. It
writes the series in the order you pass them. Read an ABS wage index and the
RBA cash rate target as one CSV file:

```shell
ausecon get A2603039T FIRMMCRTD > mixed.csv
```

The tool takes the publisher from the pattern of each series ID. An ID such as
`A2603039T` is an ABS series ID, and every other valid ID is an RBA series ID.
A prefix of `abs:` or `rba:` names the publisher:

```shell
ausecon get abs:A2603039T rba:FIRMMCRTD
```

The CSV has one row per observation, with these columns:

```text
publisher,table,tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit
```

`publisher` is `ABS` or `RBA`. `table` holds the ABS table ID or the RBA
table number.

## Read RBA Statistical Tables

`ausecon rba get` reads current statistical tables by RBA table number. Save
the daily and monthly money market rates:

```shell
ausecon rba get F1 F1.1 > rates.csv
```

The CSV has one row per observation, with these columns:

```text
tableNumber,tableTitle,date,seriesDescription,value,seriesType,frequency,seriesId,unit,title,source,publicationDate
```

`source` names the body that the statistical table gives as the origin of the
series, such as `ABS` when the RBA republishes ABS data. `publicationDate` is
empty for the C tables, which have no publication date row.

## Search for a Series

`ausecon search` finds RBA series by words. It reads the series index that
ships with the tool, so it makes no request and works offline. A series
matches when each word appears, in any case, in its series ID, title,
description, or table title:

```shell
ausecon search cash rate target
```

A terminal gets aligned columns: series ID, description, unit, frequency, and
RBA table number. A pipe gets CSV with these columns:

```text
publisher,seriesId,title,description,unit,frequency,seriesType,tableNumber,tableTitle
```

`--format json` writes the same fields as JSON. The tool shows 20 matches.
Pass `--limit` to show more, and stderr gives the number of matches when it
cuts the list:

```shell
ausecon search yield --limit 50
```

No match exits 0 with a message on stderr. The series index holds RBA series
only. Read a series that you find with `ausecon get <series id>`.

## Read ABS Time Series

`ausecon abs get` reads ABS time series from the latest release. Save every
table of the Wage Price Index:

```shell
ausecon abs get --catalogue 6345.0 > wages.csv
```

Read only tables 1 and 12 of the Labour Force release. Large catalogue
numbers such as 6202.0 have many tables, so pass table numbers:

```shell
ausecon abs get --catalogue 6202.0 --table 1 --table 12
```

The CSV has one row per observation, with the 12 `readabs` columns:

```text
tableId,sheet,tableTitle,date,seriesDescription,value,seriesType,dataType,collectionMonth,frequency,seriesId,unit
```

Pass `--catalogue`. `--table` needs `--catalogue`.

This release deprecates `abs get --series`, and the next release removes it.
It still reads ABS series IDs, and it writes a note on stderr. Use
`ausecon get` instead.

## Output Formats

`get`, `rba get`, and `abs get` take the same output flags:

- `--format csv` writes CSV. It is the default.
- `--format json` writes a list of series. Each series holds its metadata,
  its table, and its observations as `date` and `value` pairs. The
  description is in `description`, not `seriesDescription`.
- `--no-metadata` writes only series ID, date, and value as CSV, and only the
  series ID and observations of each series as JSON.

```shell
ausecon get A2603039T FIRMMCRTD --format json --no-metadata
```

## Exit Codes

Each error on stderr names a next step.

| Code | Meaning                                                                      | Next step                                                    |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 0    | The read succeeded, or a search found no match.                              | None.                                                        |
| 1    | A fault to report, such as a Time Series Directory error or a layout change. | Report it with the command you ran.                          |
| 2    | A usage error, such as a missing flag or an invalid value.                   | Run the command with `--help`.                               |
| 3    | No such catalogue number, table number, RBA table number, or series ID.      | Check the value. If an RBA value is right, update `ausecon`. |
| 4    | The ABS or the RBA gave no response, or answered with a status outside 2xx.  | Check your network, or try again later.                      |

An RBA table or series that is missing can mean that the series index in
your copy of `ausecon` is out of date. A newer release may find it:

```shell
npm install --global ausecon@latest
```

## Shell Completions

`ausecon --completions <shell>` prints a completion script for `bash`, `zsh`,
`fish`, `sh`, `powershell`, or `pwsh`.

## RBA Data

Source: Reserve Bank of Australia. The RBA publishes its statistical tables
under the Creative Commons Attribution 4.0 International licence. The RBA
does not endorse this project, and `ausecon` is not an RBA product.

The tool runs in a terminal, not a browser. A browser needs a proxy to read
ABS or RBA data, because neither site sends CORS headers.

## Links

- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [Changelog](https://github.com/jackemcpherson/ausecon/blob/main/CHANGELOG.md)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)
- [RBA statistical tables](https://www.rba.gov.au/statistics/tables/)
- [RBA copyright and disclaimer](https://www.rba.gov.au/copyright/)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
