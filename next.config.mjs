/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone: a minimal server bundle for the container image.
  output: "standalone",
  // Keep the native Postgres driver out of the bundler.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
