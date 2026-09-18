import globals from "globals";
import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist/**", ".workspaces/**", ".browser-state/**", ".cache/**", "e2e/artifacts/**"] },
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
    files: ["**/*.jsx"],
    rules: {
      "no-unused-vars": ["error", { "varsIgnorePattern": "^(h|Fragment)$" }],
    },
  },
];
