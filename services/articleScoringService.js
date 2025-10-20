'use strict';

class ArticleScoringServiceError extends Error {
    constructor(message, statusCode = 502) {
        super(message);
        this.name = 'ArticleScoringServiceError';
        this.statusCode = statusCode;
    }
}

async function rankArticles(articles, { signal } = {}) {
    validateArticlesPayload(articles);

    const serviceUrl = process.env.SCORING_SERVICE_URL || process.env.ARTICLE_SCORING_URL;
    let scoredArticles;

    if (serviceUrl) {
        scoredArticles = await callExternalService(serviceUrl, articles, { signal });
    } else {
        scoredArticles = fallbackScoreArticles(articles);
    }

    const normalized = scoredArticles.map((result, index) => normalizeResult(result, articles[index]));
    normalized.sort((a, b) => b.helpfulnessScore - a.helpfulnessScore);

    return normalized;
}

function validateArticlesPayload(articles) {
    if (!Array.isArray(articles) || articles.length === 0) {
        throw new ArticleScoringServiceError('At least one article must be provided.', 400);
    }

    const hasInvalidArticle = articles.some((article) => {
        return !article || typeof article !== 'object' || typeof article.title !== 'string';
    });

    if (hasInvalidArticle) {
        throw new ArticleScoringServiceError('Each article must include a title.', 400);
    }
}

async function callExternalService(serviceUrl, articles, { signal } = {}) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const apiKey = process.env.SCORING_SERVICE_API_KEY || process.env.ARTICLE_SCORING_API_KEY;
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(serviceUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ articles }),
        signal
    });

    if (!response.ok) {
        const message = `Article scoring service returned status ${response.status}`;
        throw new ArticleScoringServiceError(message, response.status);
    }

    const payload = await response.json();

    if (!payload || !Array.isArray(payload.results)) {
        throw new ArticleScoringServiceError('Invalid response from article scoring service.');
    }

    return payload.results;
}

function fallbackScoreArticles(articles) {
    return articles.map((article) => {
        const titleScore = scoreText(article.title, 120);
        const summaryScore = scoreText(article.summary || '', 360);
        const helpfulnessScore = Number((0.7 * titleScore + 0.3 * summaryScore).toFixed(3));

        return {
            title: article.title,
            summary: article.summary || '',
            helpfulnessScore
        };
    });
}

function scoreText(text = '', maxLength = 120) {
    if (!text) {
        return 0;
    }

    const clampedLength = Math.min(text.length, maxLength);
    return clampedLength / maxLength;
}

function normalizeResult(result, fallbackArticle = {}) {
    const helpfulnessValue = extractScore(result);

    return {
        title: result.title || fallbackArticle.title || '',
        summary: result.summary || fallbackArticle.summary || '',
        helpfulnessScore: helpfulnessValue
    };
}

function extractScore(result) {
    if (result && typeof result.helpfulnessScore === 'number' && Number.isFinite(result.helpfulnessScore)) {
        return result.helpfulnessScore;
    }

    if (result && typeof result.score === 'number' && Number.isFinite(result.score)) {
        return result.score;
    }

    if (result && typeof result.helpfulness_score === 'number' && Number.isFinite(result.helpfulness_score)) {
        return result.helpfulness_score;
    }

    return 0;
}

module.exports = {
    rankArticles,
    ArticleScoringServiceError,
    fallbackScoreArticles,
    scoreText,
    normalizeResult,
    extractScore
};
