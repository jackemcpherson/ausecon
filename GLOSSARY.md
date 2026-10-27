# `ausecon` Glossary

This glossary defines the Australian economic data terms that `ausecon` uses.
Each term names one concept. Use the listed term in code, commands, and
documentation.

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
are not always numeric, such as `62020x28` or `3222_table_a1`.
_Avoid_: Table number, table no, table code

**Series**:
One sequence of observations of one measure at one frequency.
_Avoid_: Variable, column, indicator

**Series ID**:
The ABS identifier of a series, such as `A84423050A`.
_Avoid_: Series code, key

**Observation**:
One value of a series for one period.
_Avoid_: Data point, row, record

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
