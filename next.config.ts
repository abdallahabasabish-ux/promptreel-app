import type { NextConfig } from "next";

const securityHeaders = [
  // Clickjacking protection — the app must never be framed
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  // Prevent MIME-type sniffing of user uploads served inline
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No sensitive browser APIs needed
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.space-z.ai"],
  reactStrictMode: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Uploaded videos are never served from here; static assets are immutable
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
