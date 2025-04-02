import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "i.ytimg.com",
      "i.scdn.co",
      "mosaic.scdn.co",
      "scontent-prg1-1.xx.fbcdn.net",
      "platform-lookaside.fbsbx.com",
      "scontent.xx.fbcdn.net",
      "image-cdn-fa.spotify.com",
    ],
  },
  experimental: {
    turbo: {
      resolveAlias: {
        canvas: "./empty-module.ts",
      },
    },
  },
};

export default nextConfig;
