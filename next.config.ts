import type { NextConfig } from "next";

const desktopBuild = process.env.PLACED_DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  // The Mac app (desktop/) ships the self-contained server; everything else keeps the normal build.
  output: desktopBuild ? "standalone" : undefined,
  // The Mac app runs this server from inside its signed bundle: writing the ISR/fetch cache (unstable_cache,
  // route-cache) or optimized images to .next/ there breaks the code signature and fails on a read-only
  // bundle. Keep those caches in memory only. This is baked into the standalone build (server.js embeds the
  // config), so it has to be a build-time switch, not the runtime PLACED_DESKTOP env.
  ...(desktopBuild && { images: { unoptimized: true } }),
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*", "./drizzle/**/*", "./public/fonts/**/*"] },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  // Room for a CV upload: the file itself is capped at 4 MB (lib/cv/upload-limits.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" }, ...(desktopBuild && { isrFlushToDisk: false }) },
};

export default nextConfig;
