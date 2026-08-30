import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow development origin and network access
  allowedDevOrigins: [
    "192.168.155.16",
    "localhost",
    "127.0.0.1",
    "theaters-chuck-wait-dispatch.trycloudflare.com",
  ],
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Optimization settings for handling multiple users
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
