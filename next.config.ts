import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/admin/rekap/rapor/zip': ['./lib/rapor/**/*'],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No framing: stops clickjacking of the admin and wrapping the exam in another page.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // /exam/<attempt id> is the participant's only credential; never send it to other sites.
          { key: "Referrer-Policy", value: "same-origin" },
          // Camera: the exam page checks the participant faces the phone (lib/face.ts).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        // Only the home page belongs in search results; session, exam and admin pages are per-person or private.
        source: "/(admin|exam|s)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
