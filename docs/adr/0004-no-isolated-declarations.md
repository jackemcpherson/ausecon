# No Isolated Declarations

The project turns off `isolatedDeclarations`, which the TypeScript style guide
enables. With the flag on, every exported `Schema` needs a hand-written type,
and every `Schema.TaggedError` class needs a separate annotated base constant.

The `typescript/explicit-module-boundary-types` lint rule still requires a
return type on each exported function. The build generates declaration files
with the full compiler, which is slower but correct.
