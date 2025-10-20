'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const articleScoringService = require('../services/articleScoringService');
const { resetRateLimiters } = require('../middleware/rateLimit');

const { startServer, stopServer } = require('../server');

test.before(() => {
    startServer();
});

test.after(() => {
    stopServer();
});

async function postScore(payload, headers = {}) {
    const response = await fetch('http://localhost:3000/api/articles/score', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(payload)
    });

    const body = await response.json();
    return { status: response.status, body };
}

test('returns serialized ranked articles when successful', async () => {
    resetRateLimiters();
    const originalRankArticles = articleScoringService.rankArticles;

    articleScoringService.rankArticles = async () => ([
        { title: 'Second article', summary: 'Summary B', helpfulnessScore: 0.8 },
        { title: 'First article', summary: 'Summary A', helpfulnessScore: 0.5 }
    ]);

    try {
        const response = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' },
                { title: 'Second article', summary: 'Summary B' }
            ]
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.deepEqual(response.body.results, [
            { title: 'Second article', summary: 'Summary B', helpfulnessScore: 0.8 },
            { title: 'First article', summary: 'Summary A', helpfulnessScore: 0.5 }
        ]);
    } finally {
        articleScoringService.rankArticles = originalRankArticles;
    }
});

test('returns 400 when payload is invalid', async () => {
    resetRateLimiters();
    const response = await postScore({});

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error, 'Invalid request payload');
});

test('forwards service errors with status code', async () => {
    resetRateLimiters();
    const originalRankArticles = articleScoringService.rankArticles;

    articleScoringService.rankArticles = async () => {
        throw new articleScoringService.ArticleScoringServiceError('Service unavailable', 503);
    };

    try {
        const response = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' }
            ]
        });

        assert.equal(response.status, 503);
        assert.equal(response.body.success, false);
        assert.equal(response.body.error, 'Service unavailable');
    } finally {
        articleScoringService.rankArticles = originalRankArticles;
    }
});

test('applies API key authentication when configured', async () => {
    resetRateLimiters();
    const originalRankArticles = articleScoringService.rankArticles;
    articleScoringService.rankArticles = async () => ([
        { title: 'First article', summary: 'Summary A', helpfulnessScore: 0.9 }
    ]);

    process.env.API_KEY = 'secret';

    try {
        const unauthorized = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' }
            ]
        });

        assert.equal(unauthorized.status, 401);
        assert.equal(unauthorized.body.success, false);

        const authorized = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' }
            ]
        }, { 'X-API-Key': 'secret' });

        assert.equal(authorized.status, 200);
        assert.equal(authorized.body.success, true);
    } finally {
        delete process.env.API_KEY;
        articleScoringService.rankArticles = originalRankArticles;
    }
});

test('enforces rate limiting when configured', async () => {
    resetRateLimiters();
    const originalRankArticles = articleScoringService.rankArticles;
    articleScoringService.rankArticles = async () => ([
        { title: 'First article', summary: 'Summary A', helpfulnessScore: 0.9 }
    ]);

    process.env.RATE_LIMIT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    try {
        const firstResponse = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' }
            ]
        });

        assert.equal(firstResponse.status, 200);

        const secondResponse = await postScore({
            articles: [
                { title: 'First article', summary: 'Summary A' }
            ]
        });

        assert.equal(secondResponse.status, 429);
        assert.equal(secondResponse.body.success, false);
        assert.equal(secondResponse.body.error, 'Rate limit exceeded');
    } finally {
        delete process.env.RATE_LIMIT_MAX;
        delete process.env.RATE_LIMIT_WINDOW_MS;
        articleScoringService.rankArticles = originalRankArticles;
    }
});
