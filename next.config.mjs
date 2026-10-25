/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone: a minimal server bundle for the container image.
  output: "standalone",
  // Keep the native Postgres driver and the Temporal client (gRPC) out of the bundler.
  serverExternalPackages: ["pg", "@temporalio/client"],
};

export default nextConfig;
