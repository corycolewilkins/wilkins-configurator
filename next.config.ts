import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow embedding in an iframe
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.squarespace.com https://wilkinswardrobes.uk https://www.wilkinswardrobes.uk https://wilkinswardrobes.co.uk https://www.wilkinswardrobes.co.uk",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
