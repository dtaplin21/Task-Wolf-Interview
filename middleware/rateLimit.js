// Rate limiting middleware for API protection
class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.defaultLimits = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 100, // 100 requests per window
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        };
    }

    /**
     * Create rate limiting middleware
     * @param {Object} options - Rate limiting options
     * @returns {Function} Express middleware function
     */
    createRateLimit(options = {}) {
        const config = { ...this.defaultLimits, ...options };
        
        return (req, res, next) => {
            const identifier = this.getIdentifier(req);
            const now = Date.now();
            const windowStart = now - config.windowMs;

            // Get or create request record for this identifier
            if (!this.requests.has(identifier)) {
                this.requests.set(identifier, []);
            }

            const requestTimes = this.requests.get(identifier);
            
            // Remove old requests outside the window
            const recentRequests = requestTimes.filter(time => time > windowStart);
            
            // Check if limit is exceeded
            if (recentRequests.length >= config.maxRequests) {
                const oldestRequest = Math.min(...recentRequests);
                const resetTime = oldestRequest + config.windowMs;
                
                res.set({
                    'X-RateLimit-Limit': config.maxRequests,
                    'X-RateLimit-Remaining': 0,
                    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
                    'Retry-After': Math.ceil((resetTime - now) / 1000)
                });

                return res.status(429).json({
                    success: false,
                    error: 'Too Many Requests',
                    message: `Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)} seconds.`,
                    retryAfter: Math.ceil((resetTime - now) / 1000)
                });
            }

            // Add current request
            recentRequests.push(now);
            this.requests.set(identifier, recentRequests);

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': config.maxRequests,
                'X-RateLimit-Remaining': config.maxRequests - recentRequests.length,
                'X-RateLimit-Reset': new Date(now + config.windowMs).toISOString()
            });

            next();
        };
    }

    /**
     * Get identifier for rate limiting
     * @param {Object} req - Express request object
     * @returns {string} Identifier
     */
    getIdentifier(req) {
        // Use API key if available, otherwise use IP address
        if (req.auth && req.auth.apiKey) {
            return `api:${req.auth.apiKey}`;
        }
        
        // Use IP address with user agent for better identification
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        return `ip:${ip}:${this.hashString(userAgent)}`;
    }

    /**
     * Hash string for consistent identification
     * @param {string} str - String to hash
     * @returns {string} Hashed string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Clean up old request records
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [identifier, requestTimes] of this.requests.entries()) {
            const recentRequests = requestTimes.filter(time => 
                now - time < maxAge
            );
            
            if (recentRequests.length === 0) {
                this.requests.delete(identifier);
            } else {
                this.requests.set(identifier, recentRequests);
            }
        }
    }

    /**
     * Get rate limit statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const stats = {
            totalIdentifiers: this.requests.size,
            totalRequests: 0,
            activeIdentifiers: 0,
            topIdentifiers: []
        };

        const now = Date.now();
        const activeWindow = 15 * 60 * 1000; // 15 minutes

        for (const [identifier, requestTimes] of this.requests.entries()) {
            const recentRequests = requestTimes.filter(time => 
                now - time < activeWindow
            );
            
            stats.totalRequests += requestTimes.length;
            
            if (recentRequests.length > 0) {
                stats.activeIdentifiers++;
                stats.topIdentifiers.push({
                    identifier: identifier.substring(0, 20) + '...',
                    requests: recentRequests.length
                });
            }
        }

        // Sort by request count
        stats.topIdentifiers.sort((a, b) => b.requests - a.requests);
        stats.topIdentifiers = stats.topIdentifiers.slice(0, 10);

        return stats;
    }

    /**
     * Reset rate limit for specific identifier
     * @param {string} identifier - Identifier to reset
     * @returns {boolean} Success status
     */
    resetIdentifier(identifier) {
        return this.requests.delete(identifier);
    }

    /**
     * Reset all rate limits
     */
    resetAll() {
        this.requests.clear();
    }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

/**
 * Default rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function rateLimitMiddleware(options = {}) {
    return rateLimiter.createRateLimit(options);
}

/**
 * Strict rate limiting for sensitive endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function strictRateLimit(options = {}) {
    const strictOptions = {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 10, // 10 requests per window
        ...options
    };
    
    return rateLimiter.createRateLimit(strictOptions);
}

/**
 * Lenient rate limiting for general endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function lenientRateLimit(options = {}) {
    const lenientOptions = {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 1000, // 1000 requests per window
        ...options
    };
    
    return rateLimiter.createRateLimit(lenientOptions);
}

/**
 * Per-IP rate limiting
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function perIpRateLimit(options = {}) {
    const ipOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 50, // 50 requests per IP per window
        ...options
    };
    
    return rateLimiter.createRateLimit(ipOptions);
}

/**
 * Per-API-key rate limiting
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
function perApiKeyRateLimit(options = {}) {
    const apiKeyOptions = {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 500, // 500 requests per API key per window
        ...options
    };
    
    return rateLimiter.createRateLimit(apiKeyOptions);
}

// Clean up old records every hour
setInterval(() => {
    rateLimiter.cleanup();
}, 60 * 60 * 1000);

module.exports = {
    rateLimitMiddleware,
    strictRateLimit,
    lenientRateLimit,
    perIpRateLimit,
    perApiKeyRateLimit,
    rateLimiter
};