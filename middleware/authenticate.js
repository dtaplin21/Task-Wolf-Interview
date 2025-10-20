// Authentication middleware for API endpoints
const crypto = require('crypto');

class AuthenticationService {
    constructor() {
        this.apiKeys = new Map();
        this.sessions = new Map();
        this.initializeDefaultKeys();
    }

    /**
     * Initialize default API keys for development
     */
    initializeDefaultKeys() {
        // Default API key for development (in production, use environment variables)
        const defaultKey = process.env.API_KEY || 'dev-key-12345';
        this.apiKeys.set(defaultKey, {
            key: defaultKey,
            name: 'Default Development Key',
            permissions: ['read', 'write', 'admin'],
            createdAt: new Date().toISOString(),
            lastUsed: null
        });
    }

    /**
     * Authenticate request using API key
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    authenticateRequest(req, res, next) {
        try {
            const apiKey = this.extractApiKey(req);
            
            if (!apiKey) {
                return res.status(401).json({
                    success: false,
                    error: 'API key required',
                    message: 'Please provide a valid API key in the Authorization header or query parameter'
                });
            }

            const keyInfo = this.apiKeys.get(apiKey);
            
            if (!keyInfo) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API key',
                    message: 'The provided API key is not valid'
                });
            }

            // Update last used timestamp
            keyInfo.lastUsed = new Date().toISOString();

            // Add authentication info to request
            req.auth = {
                apiKey,
                keyInfo,
                permissions: keyInfo.permissions,
                isAuthenticated: true
            };

            next();

        } catch (error) {
            console.error('[Auth] Authentication error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed',
                message: 'An error occurred during authentication'
            });
        }
    }

    /**
     * Extract API key from request
     * @param {Object} req - Express request object
     * @returns {string|null} API key
     */
    extractApiKey(req) {
        // Check Authorization header
        const authHeader = req.get('Authorization');
        if (authHeader) {
            const match = authHeader.match(/^Bearer\s+(.+)$/i);
            if (match) {
                return match[1];
            }
        }

        // Check query parameter
        if (req.query.apiKey) {
            return req.query.apiKey;
        }

        // Check body parameter
        if (req.body && req.body.apiKey) {
            return req.body.apiKey;
        }

        return null;
    }

    /**
     * Check if user has required permission
     * @param {Array} requiredPermissions - Required permissions
     * @returns {Function} Middleware function
     */
    requirePermissions(requiredPermissions) {
        return (req, res, next) => {
            if (!req.auth || !req.auth.isAuthenticated) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    message: 'Please authenticate first'
                });
            }

            const userPermissions = req.auth.permissions || [];
            const hasPermission = requiredPermissions.every(permission => 
                userPermissions.includes(permission)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions',
                    message: `Required permissions: ${requiredPermissions.join(', ')}`,
                    userPermissions
                });
            }

            next();
        };
    }

    /**
     * Generate new API key
     * @param {Object} keyInfo - Key information
     * @returns {string} Generated API key
     */
    generateApiKey(keyInfo = {}) {
        const key = crypto.randomBytes(32).toString('hex');
        const keyData = {
            key,
            name: keyInfo.name || 'Generated Key',
            permissions: keyInfo.permissions || ['read'],
            createdAt: new Date().toISOString(),
            lastUsed: null
        };

        this.apiKeys.set(key, keyData);
        return key;
    }

    /**
     * Revoke API key
     * @param {string} apiKey - API key to revoke
     * @returns {boolean} Success status
     */
    revokeApiKey(apiKey) {
        return this.apiKeys.delete(apiKey);
    }

    /**
     * List all API keys (admin only)
     * @returns {Array} List of API keys (without actual keys)
     */
    listApiKeys() {
        return Array.from(this.apiKeys.values()).map(keyInfo => ({
            name: keyInfo.name,
            permissions: keyInfo.permissions,
            createdAt: keyInfo.createdAt,
            lastUsed: keyInfo.lastUsed,
            // Don't expose the actual key for security
            keyPreview: keyInfo.key.substring(0, 8) + '...'
        }));
    }

    /**
     * Create session token
     * @param {Object} userData - User data
     * @returns {string} Session token
     */
    createSession(userData) {
        const token = crypto.randomBytes(32).toString('hex');
        const sessionData = {
            token,
            userData,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };

        this.sessions.set(token, sessionData);
        return token;
    }

    /**
     * Validate session token
     * @param {string} token - Session token
     * @returns {Object|null} Session data
     */
    validateSession(token) {
        const session = this.sessions.get(token);
        
        if (!session) {
            return null;
        }

        // Check if session is expired
        if (new Date() > new Date(session.expiresAt)) {
            this.sessions.delete(token);
            return null;
        }

        // Update last accessed time
        session.lastAccessed = new Date().toISOString();
        return session;
    }

    /**
     * Destroy session
     * @param {string} token - Session token
     * @returns {boolean} Success status
     */
    destroySession(token) {
        return this.sessions.delete(token);
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [token, session] of this.sessions.entries()) {
            if (now > new Date(session.expiresAt)) {
                this.sessions.delete(token);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`[Auth] Cleaned up ${cleanedCount} expired sessions`);
        }
    }

    /**
     * Get authentication statistics
     * @returns {Object} Auth statistics
     */
    getStats() {
        const activeSessions = Array.from(this.sessions.values()).filter(session => 
            new Date() <= new Date(session.expiresAt)
        );

        return {
            totalApiKeys: this.apiKeys.size,
            activeSessions: activeSessions.length,
            totalSessions: this.sessions.size,
            lastCleanup: new Date().toISOString()
        };
    }
}

// Create singleton instance
const authService = new AuthenticationService();

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function authenticateRequest(req, res, next) {
    return authService.authenticateRequest(req, res, next);
}

/**
 * Require specific permissions
 * @param {Array} permissions - Required permissions
 * @returns {Function} Middleware function
 */
function requirePermissions(permissions) {
    return authService.requirePermissions(permissions);
}

/**
 * Optional authentication (doesn't fail if no auth provided)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function optionalAuth(req, res, next) {
    try {
        const apiKey = authService.extractApiKey(req);
        
        if (apiKey) {
            const keyInfo = authService.apiKeys.get(apiKey);
            if (keyInfo) {
                keyInfo.lastUsed = new Date().toISOString();
                req.auth = {
                    apiKey,
                    keyInfo,
                    permissions: keyInfo.permissions,
                    isAuthenticated: true
                };
            }
        }

        if (!req.auth) {
            req.auth = {
                isAuthenticated: false,
                permissions: []
            };
        }

        next();
    } catch (error) {
        console.error('[Auth] Optional auth error:', error.message);
        req.auth = { isAuthenticated: false, permissions: [] };
        next();
    }
}

// Clean up expired sessions every hour
setInterval(() => {
    authService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = {
    authenticateRequest,
    requirePermissions,
    optionalAuth,
    authService
};