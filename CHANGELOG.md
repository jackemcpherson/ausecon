# Changelog

This file records notable changes to `ausecon` and `@ausecon/core`. Both
packages share one version number.

---

## 0.3.0 - 2026-10-29

This release reads RBA statistical tables and breaks the 0.2.0 interface.
`ausecon abs get` CSV output and exit codes do not change.

### Added

- `readRba` in `@ausecon/core` reads current RBA statistical tables by RBA
  table number with `RbaRequest.Table`, or series by series ID with
  `RbaRequest.Series`. It reads `.xlsx` and `.xls` tables, and it matches
  RBA table numbers and series IDs in any case. It fails with
  `RbaUnavailable`, `RbaTableNotFound`, `RbaSeriesNotFound`,
  `RbaTableLayoutError`, or `InvalidRequest`.
- A series index of every series in the current tables ships with the
  library. `readRba` finds each table through it. This release lists 4,364
  series from 88 tables, and 6 tables that the library cannot read: A5 and
  E3 to E7.
- `searchSeries` searches the series index by words with no request, and
  takes an optional `limit`.
- `resolveSeriesId` names the publisher of a series ID from its pattern, or
  from an `abs:` or `rba:` prefix.
- `ausecon get <series id...>` reads series IDs from the ABS and the RBA in
  one call. Its CSV columns are `publisher`, `table`, then the 8 columns that
  both publishers fill.
- `ausecon rba get <rba table number...>` reads RBA statistical tables. Its
  CSV columns are `tableNumber`, the 8 shared columns, then `title`, `source`,
  and `publicationDate`.
- `ausecon search <word...>` searches the series index. A terminal gets
  aligned columns, and a pipe gets CSV or, with `--format json`, JSON.
  `--limit` defaults to 20.
- Each RBA failure exits with the code of its ABS counterpart and names a
  next step.

### Changed

- `Series` is a union of `AbsSeries` and `RbaSeries`, tagged by a new
  `publisher` field, `ABS` or `RBA`. `readAbs` returns `AbsSeries`. Code that
  reads a field that only one member has must check `publisher` first.
- The ABS `seriesDescription` field is now `description`.
- `ausecon abs get --format json` writes each series with `publisher` and
  `description`, in place of `seriesDescription`.
- `SeriesId` accepts RBA series IDs, such as `FIRMMCRTD`, as well as ABS
  series IDs. `readAbs` still checks the ABS pattern, so an RBA series ID in
  an ABS request fails with `InvalidRequest`.

### Deprecated

- `ausecon abs get --series` writes a note on stderr that names
  `ausecon get`. The next release removes it.

## 0.2.0 - 2026-10-27

This release returns series from `readAbs` and breaks the 0.1.0 interface.
CSV output and exit codes 2 and 3 do not change.

### Added

- `parseTable` in `@ausecon/core` reads the series of one ABS time series
  table from its `.xlsx` bytes and a `Table`, with the table ID required and
  the title optional. It is the parser `readAbs` uses, and it fails with
  `TableLayoutError` for a table without the ABS time series layout.

### Changed

- `readAbs` returns a read-only array of `Series`, one per series ID and
  sheet, in place of one observation per series and period. Each `Series`
  carries its metadata once, its `Table` (`tableId` and an optional
  `tableTitle`), its sheet, and its observations as `date` and `value` pairs.
  A series request returns only the requested series.
- A series request fails with `SeriesNotFound` when the table that the Time
  Series Directory names for a series ID does not hold it. In 0.1.0 the read
  dropped the series, and `ausecon` wrote only a header and exited 0. It now
  exits 3.
- A column with a series ID in row 10 but no number cells now yields a
  `Series` with empty `observations`. In 0.1.0 it yielded nothing. JSON
  output shows such a series. CSV output does not change, because the series
  has no rows.
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
  the status if the ABS answered, and the cause as text in `detail`.
  `ReadAbsError` holds only errors the library defines.
- A Time Series Directory response that is not a series index fails with
  `TimeSeriesDirectoryError`, which names the URL and the reason. An error
  document is one such response. It no longer fails as an HTTP decode error.
  A table URL that the library cannot request fails the same way, not as an
  unavailable ABS.
- `ausecon` exits 1, not 4, when the Time Series Directory answers with an
  error document, and asks for a report. It does the same for a listed table
  URL that it cannot request. Exit 4 names the URL. Without a
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
