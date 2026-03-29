import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://unpkg.com",
              "worker-src 'self' blob:",
              "connect-src 'self' https://unpkg.com https://s3-jetl.s3.us-east-2.amazonaws.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;