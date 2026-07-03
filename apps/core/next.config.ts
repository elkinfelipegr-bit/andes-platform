import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal workspace packages ship raw TypeScript (ADR-004 monorepo);
  // Next must transpile them.
  transpilePackages: ["@andes/api", "@andes/auth", "@andes/db"],
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
