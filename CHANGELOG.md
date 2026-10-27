# Changelog

This file records notable changes to `ausecon` and `@ausecon/core`. Both
packages share one version number.

---

## Unreleased

No changes yet.

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
