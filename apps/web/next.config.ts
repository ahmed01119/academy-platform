import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@academy/shared'],
  output: process.env.BUILD_STANDALONE === 'true' || process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
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
  // Proxying to the backend API is handled dynamically at runtime by
  // apps/web/src/app/v1/[...path]/route.ts. This ensures INTERNAL_API_URL is evaluated
  // at runtime on every request without statically baking localhost into build artifacts.
  async rewrites() {
    return [];
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
