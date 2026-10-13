import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*"] },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
