import javascript from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescript from "typescript-eslint";

export default typescript.config(
  {
    ignores: ["node_modules/**", "lint/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    extends: [
      javascript.configs.recommended,
      typescript.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true },
      ],
    },
  },
);
