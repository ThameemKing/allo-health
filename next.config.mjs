/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Force fresh builds on Vercel
  staticPageGenerationTimeout: 0,
};

export default nextConfig;