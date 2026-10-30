import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const versionPath = path.resolve(process.cwd(), 'apps/web/public/version.json');
    if (fs.existsSync(versionPath)) {
      const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }
  } catch {
    // Fall back to runtime manifest
  }

  return NextResponse.json(
    {
      name: 'SPORTEXUS',
      version: '0.0.0',
      buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'standalone',
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA || 'standalone',
      builtAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
