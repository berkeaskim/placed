import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Mac app (desktop/) ships the self-contained server; everything else keeps the normal build.
  output: process.env.PLACED_DESKTOP_BUILD === "1" ? "standalone" : undefined,
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*", "./drizzle/**/*", "./public/fonts/**/*"] },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  // Room for a CV upload: the file itself is capped at 4 MB (lib/cv/upload-limits.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
