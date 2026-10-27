# Match Table Numbers Locally

The project finds a table by its table number with a local match. It fetches
every series for the catalogue number from the Time Series Directory and
matches the table titles itself. It does not send the table number to the Time
Series Directory title search, as `readabs` does.

The title search needs the exact zero padding that the ABS used in the title.
Labour Force (`6202.0`) titles use `Table 001`, so a search for `1` returns no
series, while Wage Price Index (`6345.0`) titles use `Table 1`. The search also
misses tables with an underscore suffix, such as `021_MTH`, unless the query
ends in a wildcard. `readabs` retries with one added leading zero only, so it
never finds `Table 001`.

Local matching compares table numbers without leading zeros and ignores case.
It fetches every page of the catalogue rather than only the matching series,
but gives the same result for every padding style.

The read upper-cases requested table numbers before it decodes them, as it
does for series IDs, so `x28` finds `Table X28`. The `TableNumber` schema
keeps its upper-case letter prefix. The match reads no table number from an
`APPENDIX` title, because a table number cannot name an appendix. So
`APPENDIX 2` never matches table `2`.

## Lists and Ranges

A title can name several table numbers. A list, such as `Tables 4, 5 and 6.`
or `Tables 4, 5, 6.`, names each number in it. A range, such as
`Tables 01 to 17`, names each number from one end to the other.

A range whose ends carry the same letters, such as `Tables 2a to 9a`, names
each number with those letters: `2a`, `3a`, and so on to `9a`. A range whose
ends carry different letters, such as `Tables 2a to 4b`, has no clear middle,
so it names only its two ends.
