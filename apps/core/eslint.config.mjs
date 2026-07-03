// Next.js app lint config (ADR-007): shared base + eslint-config-next via
// FlatCompat (Next's configs are still eslintrc-format).
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import base from "@andes/config/eslint.base.js";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...base,
  ...compat.extends("next/core-web-vitals"),
];

export default config;
