# A Tool, Not a Port

`ausecon` aims to be the easiest way to work with Australian economic data.
It is a command-line tool and terminal interface over ABS and RBA series,
backed by a portable library. It is not a port of the `readabs` and `readrba`
R packages.

Those packages set the coverage benchmark. Every kind of data they read,
`ausecon` should read. Their interfaces, data access, and internals are
inspiration only. Where a better design exists, `ausecon` takes it.

The project began as a port. That framing told every change to copy an R
function. Yet much of the R design follows from R conventions or from the
history of the ABS and RBA sites. A terminal interface needs browse, search,
and one view of series from both sources, which neither package provides.

## Considered Options

- Keep the port: callers who know the R packages find familiar names, but the
  tool inherits two separate interfaces and their special cases.
- Drop the R packages as a reference: no clear benchmark for coverage.

## Consequences

Release specs compare coverage with `readabs` and `readrba` and justify each
departure from their design. The ABS CSV output keeps its `readabs` columns
until a release spec changes them. The license keeps the R packages'
copyright notices.
