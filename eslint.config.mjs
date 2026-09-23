import globals from "globals";
import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist/**", ".workspaces/**", ".browser-state/**", ".cache/**", "e2e/artifacts/**"] },
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ["src/**/*.{ts,tsx}"] })),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-depth": ["error", 3],
      "no-restricted-syntax": ["error", {
        selector: "TryStatement",
        message: "Use Effect or Promise error handling.",
      }],
    },
  },
  {
    files: ["**/*.{js,mjs,jsx}"],
    plugins: {
      import: importPlugin,
      react: reactPlugin,
    },
    languageOptions: {
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        GM_info: 'readable',
        GM_addStyle: 'readable',
        GM_setValue: 'readable',
        GM_getValue: 'readable',
        GM_addValueChangeListener: 'readable',
        GM_xmlhttpRequest: 'readable',
        GM_registerMenuCommand: 'readable',
        GM_unregisterMenuCommand: 'readable',
        GM_getResourceText: 'readable',
        GM_openInTab: 'readable',
        GM_download: 'readable'
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "import/named": "error",
      "import/no-duplicates": "warn",
      "import/no-cycle": "error",
      "react/jsx-uses-vars": "error",
    },
  },
  {
    files: ["e2e/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: "readonly",
      },
    },
  },
  {
    files: ["e2e/playwright/**/*.js", "playwright.config.js"],
    rules: {
      // eslint-plugin-import cannot resolve Playwright's generated named exports.
      "import/named": "off",
    },
  },
  {
    files: ["**/*.jsx"],
    rules: {
      "no-unused-vars": ["error", { "varsIgnorePattern": "^(h|Fragment)$" }],
    },
  },
];
