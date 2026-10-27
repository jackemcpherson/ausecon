# The Library Owns Its Failures

`ReadAbsError` holds only tagged errors that `@ausecon/core` defines. No
`effect/http` type appears in it. The HTTP module maps Effect's client errors
to `AbsUnavailable` or `TimeSeriesDirectoryError` at each request, so Effect's
error type stays inside the library.

- `AbsUnavailable`: a request to the ABS got no response or a status outside
  2xx. It carries the URL, the status if the ABS answered, and the cause as
  text.
- `TimeSeriesDirectoryError`: a Time Series Directory response that is not a
  series index. An error document, malformed XML, and an unexpected layout
  all fail this way. It carries the URL and the reason. A request that was
  never sent also fails this way, such as one to an invalid URL. Table URLs
  come from the Directory, so the fault is the listing, not the network.
- `TableLayoutError`: a table that does not have the ABS time series layout.

`effect/http` is an unstable module. Its reason tags can change between
Effect releases, and every library user and the tool matched on them. The
v0.1.0 read also dressed a Time Series Directory error document as an HTTP
decode error. The tool then told the user to check their network for a fault
on the ABS side.

This decision amends ADR 0006: an `<Error>` document now fails with
`TimeSeriesDirectoryError`.

## Considered Options

- Keep `HttpClientError` in the union: no mapping code, but every Effect
  release can change what callers match on.
- One `AbsError` with a kind field: fewer types, but the tool needs a
  different exit code for a Directory fault than for an unreachable ABS.

## Consequences

`readAbs` still requires an `HttpClient`. The caller provides the client, and
only its errors stay internal. Only a status error carries a status: a body
that fails to arrive counts as no response.
