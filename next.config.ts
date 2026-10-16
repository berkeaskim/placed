import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*", "./drizzle/**/*", "./public/fonts/**/*"] },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  // Room for a CV upload: the file itself is capped at 4 MB (lib/cv/upload-limits.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
