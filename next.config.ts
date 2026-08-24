import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp", "ffmpeg-static"],
};

export default nextConfig;
