# Fast XML Parser for the Time Series Directory

The project parses Time Series Directory responses with `fast-xml-parser`
5.11.2, pinned to that exact version. The parser runs on any runtime and has
no Node APIs, so `@ausecon/core` stays portable.

The parser keeps every value as a string (`parseTagValue: false`), so values
such as `6345.0` and `001` survive. It always reads `Series` as a list, because
a page with one series would otherwise parse to a single object. A `Schema`
decodes the parsed object at the boundary. An `<Error>` document, which the
Time Series Directory returns with HTTP 200, fails the read with
`TimeSeriesDirectoryError`, as ADR 0007 records.

## Latest Release

The read keeps only rows from the latest `ProductReleaseDate` of each table.
A table is one `TableURL`, as `readabs` groups rows in `read_abs`. Rows with an
empty `TableURL` link to no table, so the read skips them.

## Considered Options

- `DOMParser`: browsers and Deno have it, but Node and Bun do not.
- `@xmldom/xmldom`: a full DOM, which is more than a flat index needs.
- `txml`: smaller, but less common and with fewer releases.

## Consequences

Check `fast-xml-parser` releases by hand when Renovate proposes an update, and
run the fixture tests against the new version.
