const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');
const metricsLogger = require('../utils/metricsLogger');

const DEFAULT_PROVIDER = 'mock-ranking-ai';
const DEFAULT_MODEL = 'ranking-v1';

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeScores(articles) {
    if (!Array.isArray(articles)) {
        return [];
    }

    const total = articles.length;
    return articles.map((article, index) => ({
        position: article.position,
        page: article.page,
        title: article.title,
        score: Number((1 - index / Math.max(total, 1)).toFixed(4))
    }));
}

async function requestAIScoring(ranking) {
    if (!ranking || !Array.isArray(ranking.articles)) {
        throw new Error('Ranking data with articles is required for AI scoring');
    }

    const requestId = randomUUID();
    const start = performance.now();
    metricsLogger.logAIRequest({
        requestId,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        operation: 'article_rescore',
        inputCount: ranking.articles.length,
        metadata: {
            rankingId: ranking.id,
            url: ranking.url
        }
    });

    try {
        // Simulate network latency for AI request
        const simulatedLatency = 150 + Math.floor(Math.random() * 250);
        await delay(simulatedLatency);

        const scoredArticles = computeScores(ranking.articles);
        const response = {
            requestId,
            provider: DEFAULT_PROVIDER,
            model: DEFAULT_MODEL,
            scoredArticles,
            latencyMs: Math.round(performance.now() - start)
        };

        metricsLogger.logAIResponse({
            requestId,
            provider: DEFAULT_PROVIDER,
            model: DEFAULT_MODEL,
            operation: 'article_rescore',
            latencyMs: response.latencyMs,
            status: 'success',
            outputCount: scoredArticles.length
        });

        return response;
    } catch (error) {
        const latencyMs = Math.round(performance.now() - start);
        metricsLogger.logAIError({
            requestId,
            provider: DEFAULT_PROVIDER,
            model: DEFAULT_MODEL,
            operation: 'article_rescore',
            latencyMs,
            error
        });
        throw error;
    }
}

module.exports = {
    requestAIScoring
};
