import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  outputFileTracingIncludes: { "/**": ["./fixtures/**/*", "./seed/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
