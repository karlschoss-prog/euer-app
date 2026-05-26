import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/euer-app",
  images: { unoptimized: true },
};

export default nextConfig;
