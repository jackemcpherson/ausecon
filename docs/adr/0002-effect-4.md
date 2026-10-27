# Effect 4

The project uses Effect 4. The TypeScript style guide shows Effect 3 names,
such as `Effect.Service` and `Schema.decodeUnknown`. Treat those examples as
patterns and use the Effect 4 names.

Vite+ 1.4 bundles Vitest 5. The `@effect/vitest` release for Vitest 5
requires Effect 4, so Effect 3 is outside the supported range of the guide's
own tools.

The `effect/unstable/cli` module can change in a minor release. Pin Effect to
an exact version.
