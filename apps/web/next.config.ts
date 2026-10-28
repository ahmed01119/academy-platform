import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@academy/shared'],
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
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
    const rawTarget = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3001';
    const apiTarget = rawTarget.replace(/\/v1\/?$/, '');
    return [
      {
        source: '/v1/:path*',
        destination: `${apiTarget}/v1/:path*`,
      },
    ];
  },
  // Ensure the Next.js server does not forward the browser's Origin header to the
  // internal API. The API's CORS only needs to trust the Next.js server itself
  // (server-to-server = no Origin header = allowed). The browser never talks to the
  // API directly, so the API does not need to know the tunnel/public URL as an origin.
  async redirects() {
    return [];
  },
};

export default nextConfig;

