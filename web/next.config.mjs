import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1',
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    return [
      {
        source: '/v1/:path*',
        destination: `${backendUrl}/v1/:path*`,
      },
      {
        source: '/inbox/:path*',
        destination: `${backendUrl}/inbox/:path*`,
      },
    ]
  },
};

export default withNextIntl(nextConfig);
