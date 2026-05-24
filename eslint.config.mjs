// ESLint 9 flat config.
//
// Notes for Phase 1+ work:
// - Next 16 removed `next lint`; we run `eslint .` directly.
// - eslint-config-next currently throws a circular-ref error via the
//   @eslint/eslintrc FlatCompat shim on ESLint 9. Once that interop is
//   fixed upstream, layer `eslint-config-next` on top of this config.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "reference/prototype/**",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.config.mjs",
      "*.config.ts",
      "*.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
