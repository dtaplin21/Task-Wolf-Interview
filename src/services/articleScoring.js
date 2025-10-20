const crypto = require('node:crypto');

const DEFAULT_CRITERIA = 'overall quality and engagement potential';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 700;

function resolveOpenAIConstructor() {
    // Support both CommonJS and ESM exports from the OpenAI SDK
    // eslint-disable-next-line global-require
    const openaiModule = require('openai');
    if (openaiModule?.OpenAI) {
        return openaiModule.OpenAI;
    }
    if (openaiModule?.default) {
        return openaiModule.default;
    }
    return openaiModule;
}

function createCacheKey(payload) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}

class ArticleScoringService {
    constructor({ client, cache, nowProvider } = {}) {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        this.timeout = parseInt(process.env.OPENAI_TIMEOUT || '30000', 10);

        if (!client) {
            if (!this.apiKey) {
                throw new Error('OPENAI_API_KEY environment variable is required to initialize the OpenAI client');
            }
            const OpenAIConstructor = resolveOpenAIConstructor();
            this.client = new OpenAIConstructor({
                apiKey: this.apiKey,
                timeout: this.timeout
            });
        } else {
            this.client = client;
        }

        this.cache = cache || new Map();
        this.now = nowProvider || (() => new Date());
    }

    async scoreArticles(rawArticles, options = {}) {
        if (!Array.isArray(rawArticles) || rawArticles.length === 0) {
            throw new Error('Articles array is required to score results');
        }

        const articles = rawArticles.map((article, index) => ({
            id: article.id || `article-${index + 1}`,
            title: article.title,
            url: article.url,
            author: article.author || article.by || 'unknown',
            points: article.points ?? article.score ?? null,
            comments: article.comments ?? article.commentCount ?? null,
            createdAt: article.createdAt || article.time || null
        }));

        const criteria = options.criteria || DEFAULT_CRITERIA;
        const cacheKey = createCacheKey({ articles, criteria, model: this.model });

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            cached.metadata.lastAccessedAt = this.now().toISOString();
            return {
                rankings: cached.rankings,
                summary: cached.summary,
                metadata: {
                    ...cached.metadata,
                    source: 'cache'
                }
            };
        }

        const prompt = this.buildPrompt(articles, criteria);

        const response = await this.client.chat.completions.create({
            model: this.model,
            temperature: DEFAULT_TEMPERATURE,
            max_tokens: DEFAULT_MAX_TOKENS,
            messages: [
                {
                    role: 'system',
                    content: 'You are an assistant that evaluates and ranks news articles. Always respond with valid JSON.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const content = response?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('OpenAI response did not include any content');
        }

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to parse OpenAI response: ${error.message}`);
        }

        if (!Array.isArray(parsed.rankings)) {
            throw new Error('OpenAI response JSON must contain a rankings array');
        }

        const rankings = parsed.rankings.map((item, index) => ({
            rank: typeof item.rank === 'number' ? item.rank : index + 1,
            articleId: item.articleId || articles[index]?.id || String(index + 1),
            score: typeof item.score === 'number' ? item.score : null,
            reasoning: item.reasoning || '',
            article: item.article || articles.find((article) => article.id === item.articleId) || articles[index]
        }));

        const createdAt = this.now().toISOString();
        const metadata = {
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : createCacheKey({ cacheKey, createdAt }),
            cacheKey,
            createdAt,
            lastAccessedAt: createdAt,
            model: this.model,
            criteria,
            promptTokens: response?.usage?.prompt_tokens ?? null,
            completionTokens: response?.usage?.completion_tokens ?? null
        };

        const cacheEntry = {
            rankings,
            summary: parsed.summary || null,
            metadata
        };

        this.cache.set(cacheKey, cacheEntry);

        return {
            rankings,
            summary: parsed.summary || null,
            metadata: {
                ...metadata,
                source: 'api'
            }
        };
    }

    buildPrompt(articles, criteria) {
        const articleLines = articles
            .map((article, index) => {
                const stats = [];
                if (article.points !== null) {
                    stats.push(`${article.points} points`);
                }
                if (article.comments !== null) {
                    stats.push(`${article.comments} comments`);
                }
                return `${index + 1}. ${article.title}\n   id: ${article.id}\n   url: ${article.url}\n   author: ${article.author}\n   stats: ${stats.join(', ') || 'n/a'}\n   createdAt: ${article.createdAt || 'unknown'}`;
            })
            .join('\n\n');

        return `Rank the following articles from best to worst using the criteria: ${criteria}.
Return a JSON object with the shape:
{
  "rankings": [
    {
      "rank": <number>,
      "articleId": <string>,
      "score": <number between 0 and 1>,
      "reasoning": <string>
    }
  ],
  "summary": <string>
}
Articles:\n${articleLines}`;
    }

    getAuditLog() {
        return Array.from(this.cache.values())
            .map((entry) => ({
                rankingsCount: entry.rankings.length,
                summary: entry.summary,
                metadata: { ...entry.metadata }
            }))
            .sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = {
    ArticleScoringService
};
