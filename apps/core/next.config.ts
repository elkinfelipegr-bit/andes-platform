import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship raw TypeScript (ADR-004 monorepo);
  // Next must transpile them.
  transpilePackages: [
    "@andes/api",
    "@andes/auth",
    "@andes/db",
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
