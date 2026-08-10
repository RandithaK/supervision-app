import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["typeorm", "better-sqlite3"],
};

export default nextConfig;
