import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      // Alternate build dirs (NEXT_DIST_DIR) — audit and e2e builds land here.
      ".next-*/**",
      ".lighthouseci/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "lib/frames.generated.ts",
      "data/**",
      "public/**",
      // Generated test output, not source.
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "drizzle/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Unused vars are a real signal in a codebase this size; allow the
      // conventional underscore escape hatch for deliberate throwaways.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // The admin panel's fire-and-forget fetches (finding M1) are exactly the
      // bug this catches. Warn now, promote to error once P6 has rewritten the
      // mutation paths to check res.ok.
      "@typescript-eslint/no-floating-promises": "off",

      // Public copy contains apostrophes and quotes; the components already
      // escape them, and this rule fires on legitimate JSX text constantly.
      "react/no-unescaped-entities": "off",
    },
  },

  {
    // Node scripts run outside the bundler and legitimately use console.
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
];

export default config;
