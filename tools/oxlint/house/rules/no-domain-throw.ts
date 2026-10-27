import { defineRule } from "@oxlint/plugins";

/**
 * Ban `throw`, `try`, and `Effect.orDie` in domain code.
 *
 * The TypeScript style guide requires expected failures to travel in the
 * Effect error channel. Enable this rule only for domain source files.
 */
export const noDomainThrowRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow throw, try/catch, and Effect.orDie in domain code.",
    },
    messages: {
      throw: "Fail with a Schema.TaggedError in the Effect error channel instead of throwing.",
      try: "Wrap the call with Effect.try or Effect.tryPromise instead of try/catch.",
      orDie: "Handle the error with Effect.catchTags instead of converting it to a defect.",
    },
  },
  createOnce(context) {
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: "throw" });
      },
      TryStatement(node) {
        context.report({ node, messageId: "try" });
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === "Identifier" &&
          (node.property.name === "orDie" || node.property.name === "orDieWith")
        ) {
          context.report({ node, messageId: "orDie" });
        }
      },
    };
  },
});
