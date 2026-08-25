import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) does dynamic require()/worker-file
  // resolution at runtime that Turbopack's bundling breaks (a real bug hit
  // during testing: "Cannot find module .../pdf.worker.mjs" even though
  // the file exists on disk — Turbopack rewrites require() into its own
  // module graph and the worker's filesystem-relative self-reference
  // doesn't survive that). Marking it external tells Next to let Node's
  // native require() handle it untouched on the server, which is where
  // it's used anyway.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
