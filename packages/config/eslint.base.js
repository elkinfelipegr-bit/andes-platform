// Shared ESLint flat config (ADR-007). Node/TypeScript packages extend this
// directly; Next.js apps compose it with eslint-config-next instead.
// The ADR-004 import-boundary rules will also live here once cross-product
// packages exist to constrain.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
