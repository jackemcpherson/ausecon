import { eslintCompatPlugin } from "@oxlint/plugins";

import { noDomainThrowRule } from "./rules/no-domain-throw.ts";

/** Project rules that close gaps between the style guide and Oxlint. */
const housePlugin = eslintCompatPlugin({
  meta: { name: "house" },
  rules: {
    "no-domain-throw": noDomainThrowRule,
  },
});

export default housePlugin;
