import type { NextConfig } from 'next';
import fs from 'fs';
import path from 'path';

// Read generated buildId and commitSha from public/version.json if available
let initialBuildId = process.env.BUILD_ID || process.env.GITHUB_SHA || '';
let initialCommitSha = process.env.COMMIT_SHA || process.env.GITHUB_SHA || '';
try {
  const versionPath = path.resolve(__dirname, 'public/version.json');
  if (fs.existsSync(versionPath)) {
    const v = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    if (v.buildId) initialBuildId = v.buildId;
    if (v.commitSha) initialCommitSha = v.commitSha;
  }
} catch {
  // Ignore file read error in edge cases
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@academy/shared'],
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  env: {
    NEXT_PUBLIC_BUILD_ID: initialBuildId,
    NEXT_PUBLIC_COMMIT_SHA: initialCommitSha,
  },
  generateBuildId: async () => initialBuildId || `build-${Date.now().toString(36)}`,
  eslint: {
    // Rely on root lint command (turbo run lint / pnpm lint)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Rely on root typecheck command (turbo run typecheck / pnpm typecheck)
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: '/v1/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
      {
        source: '/version.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/json; charset=utf-8',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
