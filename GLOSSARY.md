# `ausecon` Glossary

This glossary defines the Australian economic data terms that `ausecon` uses.
Each term names one concept. Use the listed term in code, commands, and
documentation.

---

## Series

**Publisher**:
The body whose site `ausecon` reads a series from: the ABS or the RBA.
_Avoid_: Source, provider, agency

**Series**:
One sequence of observations of one measure at one frequency.
_Avoid_: Variable, column, indicator

**Series ID**:
A publisher's identifier of a series, such as `A84423050A` (ABS) or
`FIRMMCRTD` (RBA).
_Avoid_: Series code, key, mnemonic

**Observation**:
One value of a series for one period.
_Avoid_: Data point, row, record

**Series Index**:
The list, built ahead of time, of every series ID with its description and the
table that holds it. Search reads the series index.
_Avoid_: Series list, lookup table, bundled index

**Source**:
The body that an RBA statistical table names as the origin of a series, such
as the RBA, the ABS, or the ASX. It can differ from the publisher.
_Avoid_: Publisher, origin

---

## ABS Time Series

**Catalogue Number**:
The ABS identifier of a statistical product, such as `6202.0` for the Labour
Force release.
_Avoid_: Cat number, product ID

**Release**:
One published issue of a product, such as the September 2026 Labour Force
release.
_Avoid_: Edition, version, publication

**Table**:
One time series spreadsheet within a release.
_Avoid_: Workbook, file, spreadsheet

**Table Number**:
The number in the ABS title of a table, such as `1` in "Table 1. Labour force
status". It can carry a letter prefix or suffix and an underscore suffix, such
as `X28`, `10C`, or `021_MTH`. Some tables have no table number.
_Avoid_: Table index, table no

**Table ID**:
The file name of a table without its extension, such as `6202001`. Table IDs
are not always numeric, such as `62020x28` or `3222_table_a1`. Two tables can
share a table ID when their table URLs end in the same file name.
_Avoid_: Table number, table no, table code

**Table URL**:
The address of a table that the Time Series Directory lists, such as
`https://www.abs.gov.au/.../6202001.xlsx`. The table URL identifies a table,
because table IDs are not unique.
_Avoid_: Link, file URL, spreadsheet URL

**Series Type**:
The adjustment applied to a series: original, seasonally adjusted, or trend.
_Avoid_: Adjustment, variant

**Time Series Directory**:
The ABS index of every series and the table that holds it.
_Avoid_: TSD, catalogue, search servlet

**Data Cube**:
An ABS spreadsheet outside the time series layout, such as a detailed Labour
Force cross-tabulation.
_Avoid_: Datacube, cube file

---

## RBA Statistical Tables

**Statistical Table**:
One RBA spreadsheet of related series, such as F1.1, "Interest Rates and
Yields: Money Market".
_Avoid_: RBA table, workbook, file

**RBA Table Number**:
The identifier in the title of a statistical table, such as `F1.1`, `A2`, or
`G1`.
_Avoid_: Table number, table no, table code

**Current Table**:
A statistical table that the RBA still updates.
_Avoid_: Live table, latest table

**Historical Table**:
A statistical table that holds data the RBA no longer updates, often an
earlier span of a current table.
_Avoid_: Archive, old table, discontinued table
