import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Resolves the backend base URL at RUNTIME.
 * In production, it strictly requires INTERNAL_API_URL (or NEXT_PUBLIC_API_BASE_URL).
 * It will NEVER fall back to localhost in production.
 */
export function resolveBackendBaseUrl(): string {
  const configured = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

  if (configured && configured.trim()) {
    return configured.trim().replace(/\/v1\/?$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: INTERNAL_API_URL is required in production mode. Refusing to proxy to localhost.',
    );
  }

  // Development only fallback
  return 'http://127.0.0.1:3001';
}

/**
 * Hop-by-hop headers that must not be forwarded to the upstream backend.
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  const subPath = (path || []).join('/');

  let backendBase: string;
  try {
    backendBase = resolveBackendBaseUrl();
  } catch (err: unknown) {
    console.error('[SPORTEXUS Proxy Error] Missing backend URL:', (err as Error).message);
    return NextResponse.json(
      {
        statusCode: 500,
        message:
          'Backend API endpoint is not configured. Please set INTERNAL_API_URL in environment variables.',
        error: 'Configuration Error',
      },
      { status: 500 },
    );
  }

  const query = req.nextUrl.search || '';
  const targetUrl = `${backendBase}/v1/${subPath}${query}`;

  // Forward client request headers, filtering hop-by-hop headers
  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      forwardHeaders.set(key, value);
    }
  });

  // Preserve client IP and protocol forwarding
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (clientIp) {
    forwardHeaders.set('x-forwarded-for', clientIp);
  }
  forwardHeaders.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  // Prepare request body for mutation methods
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      // Body may be empty
    }
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: 'manual',
    });

    const responseBody = await upstreamRes.arrayBuffer();

    // Prepare response headers
    const resHeaders = new Headers();
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      // Skip set-cookie here as we handle it with getSetCookie()
      if (lower !== 'set-cookie' && !HOP_BY_HOP_HEADERS.has(lower)) {
        resHeaders.set(key, val);
      }
    });

    // Forward Set-Cookie headers accurately to preserve HttpOnly auth cookies
    const setCookies =
      typeof upstreamRes.headers.getSetCookie === 'function'
        ? upstreamRes.headers.getSetCookie()
        : [];

    for (const cookie of setCookies) {
      // Sanitize any domain attribute so cookies always bind to the frontend's domain
      const sanitizedCookie = cookie.replace(/;\s*domain=[^;]+/gi, '');
      resHeaders.append('set-cookie', sanitizedCookie);
    }

    return new NextResponse(responseBody, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    console.error(
      `[SPORTEXUS Proxy Error] Failed to proxy to ${targetUrl}:`,
      (err as Error).message,
    );
    return NextResponse.json(
      {
        statusCode: 502,
        message: 'Upstream backend service is unavailable or unreachable.',
        error: 'Bad Gateway',
        target: process.env.NODE_ENV !== 'production' ? targetUrl : undefined,
      },
      { status: 502 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
export const HEAD = handleProxy;
