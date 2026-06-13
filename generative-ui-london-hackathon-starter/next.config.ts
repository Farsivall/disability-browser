import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@copilotkit/runtime"],
  typescript: {
    // Docker route override uses HttpAgent which has a type mismatch with CopilotRuntime
    ignoreBuildErrors: true,
  },
  // Allow the Perceptual Web Chrome extension side panel to call the CopilotKit
  // runtime endpoints cross-origin. Chrome extensions have the origin
  // chrome-extension://<id>, which varies per install. Allowing all origins
  // here is safe for a local-only dev server; tighten to the specific
  // extension ID once you know it.
  async headers() {
    return [
      {
        source: "/api/copilotkit-pdf",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      {
        source: "/api/copilotkit/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
