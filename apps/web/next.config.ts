import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@academy/shared'],
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiTarget = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    return [
      {
        source: '/v1/:path*',
        destination: `${apiTarget}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
