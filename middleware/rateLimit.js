'use strict';

const defaultWindowMs = 60_000;
const defaultMaxRequests = 60;

const buckets = new Map();

function getRateLimitConfig() {
    return {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || defaultWindowMs),
        maxRequests: Number(process.env.RATE_LIMIT_MAX || defaultMaxRequests)
    };
}

function rateLimitMiddleware(req, res, next) {
    const { windowMs, maxRequests } = getRateLimitConfig();

    if (!maxRequests || maxRequests < 0) {
        return next();
    }

    const identifier = getClientIdentifier(req);
    const now = Date.now();
    const bucket = buckets.get(identifier);

    if (!bucket || bucket.expiresAt <= now) {
        buckets.set(identifier, { count: 1, expiresAt: now + windowMs });
        return next();
    }

    if (bucket.count >= maxRequests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
        res.set('Retry-After', retryAfterSeconds.toString());
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            details: `Please retry after ${retryAfterSeconds} seconds.`
        });
    }

    bucket.count += 1;
    return next();
}

function getClientIdentifier(req) {
    const apiKey = req.get('x-api-key');
    if (apiKey) {
        return `key:${apiKey}`;
    }

    const authHeader = req.get('authorization');
    if (authHeader) {
        return `auth:${authHeader}`;
    }

    return `ip:${req.ip}`;
}

function resetRateLimiters() {
    buckets.clear();
}

module.exports = {
    rateLimitMiddleware,
    resetRateLimiters,
    getRateLimitConfig
};
