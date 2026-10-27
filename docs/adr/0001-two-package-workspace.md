# Two-Package Workspace

The repository is a Bun workspace with two published packages. The
`@ausecon/core` package holds the data library and runs without Node APIs. The
`ausecon` package holds the command-line tool and the terminal interface. A
third, private package, `@ausecon/testkit`, holds the recorded fixtures and
test helpers that both test suites import. It is never published.

The TypeScript style guide shows a single `src/` tree. A terminal interface
library such as Ink or OpenTUI brings React or a native binary. One package
would install those dependencies for every library user, so the split keeps
the library small and portable.
