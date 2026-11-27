import type { NextConfig } from "next";
import { EMBED_FRAME_ORIGINS } from "./src/puck/embed-providers";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Enables forbidden() (still experimental in 16.4).
  experimental: { authInterrupts: true },
  // Thumbnails (and #14 images) go through the optimizer, which fetches the public /media route, never the bucket.
  images: { localPatterns: [{ pathname: "/media/**", search: "" }] },
  // Second wall behind the Video/Embed allowlist: frames load only from these hosts. Only frame-src, so no script nonces:
  // a host-only script-src would block other hosts but not inline injection (Next's own inline scripts need
  // 'unsafe-inline' or per-request nonces, which break static prerender), and it would also need connect-src and
  // img-src for the analytics hosts. The control for analytics is the provider allowlist plus the three ID checks.
  async headers() {
    const csp = `frame-src 'self' ${EMBED_FRAME_ORIGINS.join(" ")}`;
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: csp }] }];
  },
  // The news index is one static route, /news/page/[n]. A news/page.tsx would prerender at build (no DB) and bake an
  // empty list with no cache tag. Redirects run before rewrites, so /news/page/1 → /news → page 1 does not loop.
  async rewrites() {
    return [{ source: "/news", destination: "/news/page/1" }];
  },
  async redirects() {
    return [{ source: "/news/page/1", destination: "/news", permanent: true }];
  },
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
