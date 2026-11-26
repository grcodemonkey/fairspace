import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Enables forbidden() (still experimental in 16.4).
  experimental: { authInterrupts: true },
  // Thumbnails (and #14 images) go through the optimizer, which fetches the public /media route, never the bucket.
  images: { localPatterns: [{ pathname: "/media/**", search: "" }] },
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
