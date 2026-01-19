/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1',
  },
  experimental: {
    allowedDevOrigins: [
      // Allow local network access (192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x)
      /192\.168\.\d+\.\d+/,
      /10\.\d+\.\d+\.\d+/,
      /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
    ],
  },
};

export default nextConfig;
