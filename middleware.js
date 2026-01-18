import { NextResponse } from 'next/server';

/**
 * Rate Limiter Configuration
 *
 * PRODUCTION NOTES:
 * -----------------
 * The default in-memory rate limiter works well for single-instance deployments
 * but will NOT work correctly with multiple server instances (e.g., load-balanced
 * environments, serverless functions, etc.) because each instance maintains its
 * own separate rate limit state.
 *
 * For production multi-instance deployments, you should use a distributed
 * rate limiting solution:
 *
 * 1. **Upstash Redis** (Recommended for Serverless)
 *    - Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
 *    - This middleware will automatically use Upstash when configured
 *    - Works great with Vercel, Netlify, and other serverless platforms
 *    - Free tier available: https://upstash.com/
 *
 * 2. **Redis** (Self-hosted or managed)
 *    - Use ioredis or redis package
 *    - Implement sliding window or token bucket algorithm
 *    - Example services: AWS ElastiCache, Redis Cloud, etc.
 *
 * 3. **Vercel Edge Config** (Vercel-specific)
 *    - Use @vercel/edge-config for edge-based rate limiting
 *
 * TODO: For production with multiple instances, implement Redis-based rate limiting
 */

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
 * Check if Upstash Redis is configured
 * @returns {boolean}
 */
function isUpstashConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * In-memory rate limiter for development/single-instance
 * Simple fixed window implementation using Map
 */
class InMemoryRateLimiter {
  constructor() {
    this.store = new Map();
    // Run cleanup every 5 minutes
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  async checkLimit(key, limit) {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
      entry = { count: 1, windowStart: now };
      this.store.set(key, entry);
      return {
        limited: false,
        remaining: limit - 1,
        resetIn: RATE_LIMIT_WINDOW,
      };
    }

    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    const resetIn = RATE_LIMIT_WINDOW - (now - entry.windowStart);

    return {
      limited: entry.count > limit,
      remaining: entry.count > limit ? 0 : remaining,
      resetIn,
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Upstash Redis rate limiter for production/multi-instance
 * Uses REST API for serverless compatibility
 */
class UpstashRateLimiter {
  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  async checkLimit(key, limit) {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / RATE_LIMIT_WINDOW)}`;

    try {
      // Increment counter and set expiry in one pipeline
      const response = await fetch(`${this.baseUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', windowKey],
          ['PEXPIRE', windowKey, RATE_LIMIT_WINDOW + 1000], // Add 1s buffer
        ]),
      });

      if (!response.ok) {
        console.error('Upstash rate limit check failed:', response.status);
        // Fail open - allow request if Redis fails
        return { limited: false, remaining: limit, resetIn: RATE_LIMIT_WINDOW };
      }

      const results = await response.json();
      const count = results[0]?.result || 1;
      const resetIn = RATE_LIMIT_WINDOW - (now % RATE_LIMIT_WINDOW);
      const remaining = Math.max(0, limit - count);

      return {
        limited: count > limit,
        remaining: count > limit ? 0 : remaining,
        resetIn,
      };
    } catch (error) {
      console.error('Upstash rate limit error:', error);
      // Fail open - allow request if Redis fails
      return { limited: false, remaining: limit, resetIn: RATE_LIMIT_WINDOW };
    }
  }
}

// Initialize rate limiter based on configuration
// Upstash is used if configured, otherwise falls back to in-memory
const rateLimiter = isUpstashConfigured()
  ? new UpstashRateLimiter()
  : new InMemoryRateLimiter();

// Log which rate limiter is being used (only on server startup)
if (typeof process !== 'undefined' && process.env) {
  const limiterType = isUpstashConfigured() ? 'Upstash Redis (distributed)' : 'In-Memory (single instance)';
  console.log(`[Rate Limiter] Using ${limiterType}`);
}

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

  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Check if request is rate limited
 * @param {string} ip - Client IP
 * @param {string} endpoint - API endpoint
 * @returns {Promise<{limited: boolean, remaining: number, resetIn: number}>}
 */
async function checkRateLimit(ip, endpoint) {
  const key = `${ip}:${endpoint}`;
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  return rateLimiter.checkLimit(key, limit);
}

/**
 * Next.js Middleware
 * Handles: Rate limiting, Security headers
 *
 * Note: This middleware is async to support distributed rate limiting with Upstash Redis
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check endpoint
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Skip CSRF endpoint (needs to be accessible for token generation)
  if (pathname === '/api/csrf') {
    return NextResponse.next();
  }

  const clientIP = getClientIP(request);

  // Normalize endpoint for rate limiting (strip query params, normalize path)
  const endpoint = pathname.split('?')[0];

  // Check rate limit (async for distributed rate limiting support)
  const { limited, remaining, resetIn } = await checkRateLimit(clientIP, endpoint);

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
