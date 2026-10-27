import { CliOutput } from "effect/cli";

/**
 * Build the help formatter, which puts examples before everything else.
 *
 * The default `effect/cli` formatter prints examples last. Users learn a
 * command fastest from its examples, so this formatter moves them to the top.
 *
 * @param hasColours - Whether to style the help with ANSI colours.
 * @returns The formatter.
 */
export const helpFormatter = (hasColours: boolean): CliOutput.Formatter => {
  const base = CliOutput.defaultFormatter({ colors: hasColours });
  const bold = (text: string): string => (hasColours ? `\u001B[1m${text}\u001B[0m` : text);

  return {
    // `defaultFormatter` returns a plain object of functions, so the spread keeps
    // every member. The rule cannot tell it from a class instance.
    // oxlint-disable-next-line typescript/no-misused-spread
    ...base,
    formatHelpDoc: (doc) => {
      const examples = doc.examples ?? [];
      const rest = base.formatHelpDoc({ ...doc, examples: [] });

      return examples.length === 0
        ? rest
        : [
            bold("EXAMPLES"),
            ...examples.flatMap((example) => [
              ...(example.description === undefined ? [] : [`  # ${example.description}`]),
              `  ${example.command}`,
            ]),
            "",
            rest,
          ].join("\n");
    },
  };
};
