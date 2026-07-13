import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship raw TypeScript (ADR-004 monorepo);
  // Next must transpile them.
  transpilePackages: [
    "@andes/api",
    "@andes/auth",
    "@andes/db",
    "@andes/geo",
    "@andes/storage",
    "@andes/structures",
    "@andes/ui",
  ],
  // Prisma's generated client (and its query engine binary) lives under the
  // pnpm store at the monorepo root; Vercel's file tracing misses it, leaving
  // serverless functions without an engine at runtime (ADR-005). Include it
  // explicitly for every route.
  outputFileTracingIncludes: {
    "/**": ["../../node_modules/.pnpm/**/.prisma/client/**"],
  },
  // The 3D viewer stack is client-only (RFC-002: dynamically imported,
  // never runs on the server) — excluding it from server file tracing
  // keeps the trace graph inside this machine's memory budget.
  outputFileTracingExcludes: {
    "/**": [
      "../../node_modules/.pnpm/**/three/**",
      "../../node_modules/.pnpm/**/web-ifc/**",
      "../../node_modules/.pnpm/**/@thatopen/**",
    ],
  },
  webpack: (config) => {
    // Workspace packages use NodeNext-style ".js" specifiers that resolve
    // to .ts sources; teach webpack the same rewrite tsc/vitest apply.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
