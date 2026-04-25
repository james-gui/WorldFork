/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  output: 'standalone',
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
