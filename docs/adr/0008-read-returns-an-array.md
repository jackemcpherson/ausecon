# The Read Returns an Array

`readAbs` returns an `Effect` that yields a read-only array of `Series`, not
a `Stream`. The read finishes every download and parse before it yields.

- A `Stream` is a second concept for every caller. Most callers want the
  whole result, and an array needs no new type to learn.
- A consumer that wants a `Stream` builds one from the array in one call,
  with `Stream.fromIterable`.
- The `Series` shape stores each metadata string once per series, not once
  per observation. The result of a large read stays small enough to hold.
- The tool writes stdout only after the read succeeds. A failed read leaves
  stdout empty, so a pipe never gets half a CSV. A stream would give that up
  or buffer the stream back into an array.

## Considered Options

- Return a `Stream` of series: callers could start work before the last
  table arrives. Every caller would pay for the second concept, and the tool
  would buffer it anyway.
- Return both: two entry points to document, test, and keep in step.

## Consequences

A read holds every series of the request in memory at once. Large catalogue
numbers such as 6202.0 need table numbers or series IDs to stay small. A
streaming read is out of scope until a caller needs one, and adding it later
does not break the array read.
