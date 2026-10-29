# RBA Series Index Built Ahead of Time

`@ausecon/core` ships a generated series index for the RBA. A script,
`bun run rba:index`, scrapes the RBA statistical table pages, downloads every
current table, and writes the index into the library before each release. The
index holds each series ID with its description, unit, frequency, series type,
and table. It also holds each table's RBA table number, URL, and last-modified
date. A
read finds tables through the index. It never parses RBA web pages at run
time.

The RBA has no service that maps a series ID to its table, and no API. The
`readrba` package also ships a series list that a build script generates, and
re-scrapes the listing page when a stored URL fails.

- A run-time scrape needs an HTML parser in a library that must run on any
  runtime, and a request before every read.
- Searching run-time downloads means about 100 requests per search.
- Search needs the descriptions, units, and frequencies, which only the table
  files hold.

## Considered Options

- Scrape the listing page at run time: always current, but it gives no series
  IDs. It also needs an HTML parser in core and one more request per read.
- Require a table number with every series ID: no index, but a series ID
  read is the point of the feature.
- Host the index outside the package: needed for the larger ABS index, but
  the RBA index is small enough to ship in the library.

## Consequences

The index goes stale between releases. A series or table that the RBA adds
after a release is not found, and the error says the index may be out of
date. A table URL that answers 404 fails with `RbaTableNotFound` for the same
reason. The index lists each table that failed to parse at index time, with the
reason. The ABS keeps the Time Series Directory for reads. A later
release decides where an ABS series index lives, after measuring its size.

The first full index held 4,364 series from 88 tables. It adds about 1.8 MB
to the built library, or about 70 KB gzipped. A later release can move the
index behind its own entry point if that size troubles callers who read only
ABS data.
