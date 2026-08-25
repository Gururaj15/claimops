import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) and better-sqlite3 both do dynamic
  // require()/worker-file resolution at runtime that Turbopack's bundling
  // breaks (a real bug hit during testing: "Cannot find module
  // .../pdf.worker.mjs" even though the file exists on disk — Turbopack
  // rewrites require() into its own module graph and the worker's
  // filesystem-relative self-reference doesn't survive that). Marking them
  // external tells Next to let Node's native require() handle them
  // untouched on the server, which is where they're used anyway.
  serverExternalPackages: ["pdf-parse", "better-sqlite3"],
};

export default nextConfig;
