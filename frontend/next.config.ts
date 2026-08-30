import type { NextConfig } from "next";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    unoptimized: true, // Prevents Letterboxd anti-hotlink CDN 403 blocks when Next.js server attempts image optimization
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ltrbxd.com",
      },
      {
        protocol: "https",
        hostname: "s.ltrbxd.com",
      },
      {
        protocol: "https",
        hostname: "a.ltrbxd.com",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
