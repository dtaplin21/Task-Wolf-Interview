'use strict';

/**
 * Middleware that optionally enforces API key authentication.
 * If no API key is configured, requests are allowed to proceed.
 */
function authenticateRequest(req, res, next) {
    const expectedApiKey = process.env.API_KEY || process.env.ARTICLE_SCORING_API_KEY;

    if (!expectedApiKey) {
        return next();
    }

    const providedKey = extractApiKey(req);

    if (providedKey && providedKey === expectedApiKey) {
        return next();
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        details: 'A valid API key must be provided in the X-API-Key header or Bearer token.'
    });
}

function extractApiKey(req) {
    const headerKey = req.get('x-api-key');
    if (headerKey) {
        return headerKey;
    }

    const authHeader = req.get('authorization');
    if (!authHeader) {
        return null;
    }

    const matches = authHeader.match(/^Bearer\s+(\S+)$/i);
    return matches ? matches[1] : null;
}

module.exports = authenticateRequest;
module.exports.extractApiKey = extractApiKey;
