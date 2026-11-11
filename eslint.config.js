import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules", "samples"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
  // code inside page.evaluate / waitForFunction runs in the browser
  { files: ["src/capture.js", "src/index.js"], languageOptions: { globals: globals.browser } },
];
