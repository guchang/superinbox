/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1',
  },
  experimental: {
    allowedDevOrigins: [
      '192.168.31.*',
      'localhost',
      '127.0.0.1',
    ],
  },
};

export default nextConfig;
