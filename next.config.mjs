/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // pdf-parse (pdfjs-dist under the hood) resolves its worker file relative to
  // its own install path at runtime — bundling it into the server chunk breaks
  // that resolution ("Cannot find module .../pdf.worker.mjs"). Leaving it
  // external keeps the native require() pdfjs-dist expects.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
}

export default nextConfig
