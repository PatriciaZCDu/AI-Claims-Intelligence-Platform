import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow displaying uploaded damage photos served from Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
