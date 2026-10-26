import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: { root: path.resolve(__dirname) },
  // Allows the static ZIP to be hosted at a subpath as well as a domain root.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};
export default config;
