# Changelog

This file records notable changes to `ausecon` and `@ausecon/core`. Both
packages share one version number.

---

## Unreleased

This release returns series from `readAbs`.

### Added

- `parseTable` in `@ausecon/core` reads the series of one ABS time series
  table from its `.xlsx` bytes and a `Table`, with the table ID required and
  the title optional. It is the parser `readAbs` uses, and it fails with
  `WorkbookLayoutError` for a table without the ABS time series layout.

### Changed

- `readAbs` returns a read-only array of `Series`, one per series ID and
  sheet. Each `Series` carries its metadata once, its `Table` (`tableId` and
  an optional `tableTitle`), its sheet, and its observations as `date` and
  `value` pairs. A series request returns only the requested series.
- `Series.seriesId` is the branded `SeriesId`, the same type as
  `SeriesNotFound.seriesIds`. A table whose row 10 holds text that is not a
  series ID fails with `TableLayoutError`.
- `readAbs` takes one argument. This release removes the options argument,
  `hasMetadata`, `ReadOptions`, and `ObservationValue`.
- `@ausecon/core` no longer exports the decoded request schemas
  `CatalogueRequest`, `SeriesRequest`, and `DecodedAbsRequest`.
- `ausecon abs get --format json` writes the list of series as `readAbs`
  returns it. With `--no-metadata`, each series holds only its series ID and
  observations. CSV output does not change.
- `WorkbookLayoutError` is now `TableLayoutError`, with the same fields.
- `AbsUnavailable` replaces Effect's `HttpClientError`. It carries the URL,
  the status if the ABS answered, and the cause as text. `ReadAbsError` holds
  only errors the library defines.
- A Time Series Directory response that is not a series index fails with
  `TimeSeriesDirectoryError`, which names the URL and the reason. An error
  document is one such response. It no longer fails as an HTTP decode error.
- `ausecon` exits 1, not 4, when the Time Series Directory answers with an
  error document, and asks for a report. Exit 4 names the URL. Without a
  status it points at the network. With one it suggests trying later.

## 0.1.0 - 2026-10-27

This release reads ABS time series from the latest release.

### Added

- `readAbs` in `@ausecon/core` reads every table of a catalogue number,
  chosen tables by table number, or a list of series IDs from any catalogue
  numbers. It returns one observation per series and period, with the 12
  `readabs` columns in camelCase.
- `readAbs` takes `{ hasMetadata: false }` to return only the series ID, date,
  and value of each observation.
- `readAbs` needs an `HttpClient` from the caller and runs on Node, Bun, and
  Deno. It fails with tagged errors: `InvalidRequest`, `CatalogueNotFound`,
  `TableNotFound`, `SeriesNotFound`, `WorkbookLayoutError`, and
  `HttpClientError`.
- `ausecon abs get` reads ABS time series to stdout as CSV or JSON, with
  `--catalogue`, repeatable `--table` and `--series`, `--format`, and
  `--no-metadata`.
- Each `ausecon` error names a next step. The tool exits 2 for usage errors,
  3 for a missing catalogue number, table number, or series ID, and 4 for
  network or HTTP failures.
- A weekly live test reads a table number and a series ID from the real ABS.
- The package guides show how to read data with the library and the tool.

## 0.0.1 - 2026-10-27

This release tests trusted publishing from CI. It reads no ABS data yet.

### Added

- Bun workspace with the `@ausecon/core` library and the `ausecon`
  command-line tool.
- Domain schemas for catalogue numbers, series IDs, and table numbers.
- Continuous integration, weekly live ABS checks, and npm release workflows.
- A README in each package.
