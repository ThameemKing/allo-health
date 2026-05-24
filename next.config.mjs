/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Force new deployment
  generateBuildId: async () => {
    return new Date().getTime().toString();
  },
};

export default nextConfig;