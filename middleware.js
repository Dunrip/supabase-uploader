import { NextResponse } from 'next/server';

/**
 * Simple in-memory rate limiter
 * Note: In production with multiple instances, use Redis or a similar distributed store
 */
const rateLimitMap = new Map();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const RATE_LIMITS = {
  '/api/upload': 20,      // 20 uploads per minute
  '/api/download': 100,   // 100 downloads per minute
  '/api/files': 100,      // 100 list/delete requests per minute
  '/api/buckets': 50,     // 50 bucket requests per minute
  '/api/preview': 100,    // 100 preview requests per minute
  default: 100,           // Default: 100 requests per minute
};

/**
 * Get client IP from request headers
 * @param {Request} request
 * @returns {string}
 */
function getClientIP(request) {
  // Check various headers for proxied requests
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Check if request is rate limited
 * @param {string} ip - Client IP
 * @param {string} endpoint - API endpoint
 * @returns {{limited: boolean, remaining: number, resetIn: number}}
 */
function checkRateLimit(ip, endpoint) {
  const now = Date.now();
  const key = `${ip}:${endpoint}`;

  // Get the limit for this endpoint
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default;

  // Get or create rate limit entry
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    // Create new window
    entry = {
      count: 1,
      windowStart: now,
    };
    rateLimitMap.set(key, entry);
    return {
      limited: false,
      remaining: limit - 1,
      resetIn: RATE_LIMIT_WINDOW,
    };
  }

  // Increment count
  entry.count++;

  const remaining = Math.max(0, limit - entry.count);
  const resetIn = RATE_LIMIT_WINDOW - (now - entry.windowStart);

  if (entry.count > limit) {
    return {
      limited: true,
      remaining: 0,
      resetIn,
    };
  }

  return {
    limited: false,
    remaining,
    resetIn,
  };
}

/**
 * Clean up old rate limit entries periodically
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

/**
 * Next.js Middleware
 * Handles: Rate limiting, Security headers
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check endpoint
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  const clientIP = getClientIP(request);

  // Normalize endpoint for rate limiting (strip query params, normalize path)
  const endpoint = pathname.split('?')[0];

  // Check rate limit
  const { limited, remaining, resetIn } = checkRateLimit(clientIP, endpoint);

  if (limited) {
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(resetIn / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(resetIn / 1000)),
          'X-RateLimit-Limit': String(RATE_LIMITS[endpoint] || RATE_LIMITS.default),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000)),
        },
      }
    );
  }

  // Continue with request
  const response = NextResponse.next();

  // Add rate limit headers to response
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetIn / 1000)));

  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: '/api/:path*',
};
