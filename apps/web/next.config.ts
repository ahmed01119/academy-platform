import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';

// Read generated buildId from public/version.json if available
let initialBuildId = process.env.BUILD_ID || process.env.GITHUB_SHA || '';
try {
  const versionPath = path.resolve(__dirname, 'public/version.json');
  if (fs.existsSync(versionPath)) {
    const v = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    if (v.buildId) initialBuildId = v.buildId;
  }
} catch {
  // Ignore file read error in edge cases
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@academy/shared'],
  output:
    process.env.BUILD_STANDALONE === 'true' || process.env.NODE_ENV === 'production'
      ? 'standalone'
      : undefined,
  env: {
    NEXT_PUBLIC_BUILD_ID: initialBuildId,
  },
  async headers() {
    return [
      {
        source: '/version.json',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
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
