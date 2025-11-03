// eslint.config.mjs — ESLint v9 (Flat Config)
import js from "@eslint/js";
import globals from "globals";

export default [
  // Ignorar o que não interessa
  {
    ignores: [
      "**/node_modules/**",
      "**/.venv/**",
      "**/venv/**",
      "static/**/dist/**",
      "static/**/*.min.js",
    ],
  },

  // Lint APENAS nos arquivos do painel
  {
    files: ["static/financeiro/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        Chart: "readonly",
        bootstrap: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
    },
  },
];
