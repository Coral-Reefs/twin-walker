import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the dev badge off the map during live demos.
  devIndicators: false,
  // Type safety is enforced by `npm run typecheck`; no ESLint setup in this MVP.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
