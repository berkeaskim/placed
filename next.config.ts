import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*", "./drizzle/**/*", "./public/fonts/**/*"] },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  // Vercel caps request bodies at 4.5 MB; the CV file itself is capped at 4 MB (lib/cv/upload-limits.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
