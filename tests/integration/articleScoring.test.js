const test = require('node:test');
const assert = require('node:assert/strict');

const { ArticleScoringService } = require('../../src/services/articleScoring');

test('scores articles, caches results, and records audit metadata', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-test';
    process.env.OPENAI_TIMEOUT = '15000';

    const timeline = [
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-01-01T00:05:00.000Z'),
        new Date('2024-01-01T00:10:00.000Z')
    ];

    let callCount = 0;
    const mockClient = {
        chat: {
            completions: {
                create: async (payload) => {
                    callCount += 1;
                    assert.equal(payload.model, 'gpt-test');
                    assert.equal(payload.temperature, 0.2);
                    assert.equal(payload.max_tokens, 700);
                    assert.ok(Array.isArray(payload.messages));
                    assert.match(payload.messages[1].content, /Rank the following articles/);

                    return {
                        choices: [
                            {
                                message: {
                                    content: JSON.stringify({
                                        rankings: [
                                            {
                                                rank: 1,
                                                articleId: 'a-1',
                                                score: 0.95,
                                                reasoning: 'Clear explanation and strong engagement signals'
                                            },
                                            {
                                                rank: 2,
                                                articleId: 'a-2',
                                                score: 0.65,
                                                reasoning: 'Interesting but with lower engagement metrics'
                                            }
                                        ],
                                        summary: 'Two articles scored with focus on engagement potential.'
                                    })
                                }
                            }
                        ],
                        usage: {
                            prompt_tokens: 321,
                            completion_tokens: 210
                        }
                    };
                }
            }
        }
    };

    const service = new ArticleScoringService({
        client: mockClient,
        nowProvider: () => timeline.shift() || new Date('2024-01-01T00:15:00.000Z')
    });

    const articles = [
        {
            id: 'a-1',
            title: 'Exploring Node.js Test Runner',
            url: 'https://example.com/node-test-runner',
            author: 'Alice',
            points: 120,
            comments: 45,
            createdAt: '2024-01-01T00:00:00.000Z'
        },
        {
            id: 'a-2',
            title: 'Scaling Playwright Tests Efficiently',
            url: 'https://example.com/playwright-scaling',
            author: 'Bob',
            points: 80,
            comments: 32,
            createdAt: '2024-01-01T00:01:00.000Z'
        }
    ];

    const firstResult = await service.scoreArticles(articles, { criteria: 'engagement' });

    assert.equal(callCount, 1);
    assert.equal(firstResult.rankings.length, 2);
    assert.equal(firstResult.metadata.source, 'api');
    assert.equal(firstResult.metadata.model, 'gpt-test');
    assert.equal(firstResult.metadata.criteria, 'engagement');
    assert.equal(firstResult.metadata.promptTokens, 321);
    assert.equal(firstResult.metadata.completionTokens, 210);

    const secondResult = await service.scoreArticles(articles, { criteria: 'engagement' });

    assert.equal(callCount, 1, 'expected cached result to be used for identical payload');
    assert.equal(secondResult.metadata.source, 'cache');
    assert.notEqual(secondResult.metadata.lastAccessedAt, firstResult.metadata.lastAccessedAt);

    const auditLog = service.getAuditLog();
    assert.equal(auditLog.length, 1);
    assert.equal(auditLog[0].metadata.promptTokens, 321);
    assert.equal(auditLog[0].metadata.completionTokens, 210);
    assert.equal(auditLog[0].metadata.lastAccessedAt, '2024-01-01T00:05:00.000Z');
});
