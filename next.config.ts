import type { NextConfig } from "next";

const remotionRenderTrace = [
  "./node_modules/@remotion/renderer/**",
  "./node_modules/@remotion/bundler/**",
  "./node_modules/@remotion/compositor-*/**",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_MP4_RENDER: process.env.VERCEL === "1" ? "0" : "1",
  },
  // Chromium for renderMedia cannot run inside a Vercel function, and it blows the bundle.
  outputFileTracingExcludes: {
    "/api/summary/render": remotionRenderTrace,
    "/api/story/render": remotionRenderTrace,
  },
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler", "@remotion/compositor-linux-x64-gnu"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
