import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: [
    "@langfuse/otel",
    "@langfuse/tracing",
    "@opentelemetry/sdk-node",
  ],
};

export default nextConfig;
