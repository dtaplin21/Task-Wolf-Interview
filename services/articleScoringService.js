// Article Scoring Service for content analysis and ranking
const aiScoringService = require('./aiScoringService');
const metricsLogger = require('../utils/metricsLogger');

class ArticleScoringServiceError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'ArticleScoringServiceError';
        this.statusCode = statusCode;
    }
}

class ArticleScoringService {
    constructor() {
        this.scoringCache = new Map();
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
        this.maxConcurrentScoring = 3;
        this.activeScoringJobs = new Set();
    }

    /**
     * Score and rank articles
     * @param {Array} articles - Articles to score
     * @param {Object} options - Scoring options
     * @returns {Promise<Array>} Ranked articles with scores
     */
    async rankArticles(articles, options = {}) {
        const requestId = options.requestId || this.generateRequestId();
        
        try {
            console.log(`[ArticleScoring] Starting scoring for ${articles.length} articles (request: ${requestId})`);

            if (!Array.isArray(articles) || articles.length === 0) {
                throw new ArticleScoringServiceError('Articles array is required and must not be empty', 400);
            }

            // Check cache first
            const cacheKey = this.generateCacheKey(articles);
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
                console.log(`[ArticleScoring] Returning cached result for request ${requestId}`);
                return cachedResult;
            }

            // Limit concurrent scoring jobs
            if (this.activeScoringJobs.size >= this.maxConcurrentScoring) {
                throw new ArticleScoringServiceError('Too many concurrent scoring requests', 429);
            }

            const jobId = `${requestId}-${Date.now()}`;
            this.activeScoringJobs.add(jobId);

            try {
                // Score articles using multiple methods
                const scoredArticles = await this.scoreArticles(articles, requestId);
                
                // Rank articles by score
                const rankedArticles = this.rankArticlesByScore(scoredArticles);
                
                // Cache the result
                this.setCachedResult(cacheKey, rankedArticles);
                
                console.log(`[ArticleScoring] Completed scoring for request ${requestId}`);
                
                metricsLogger.logSystemEvent('article-scoring-completed', {
                    requestId,
                    articlesCount: articles.length,
                    jobId
                });

                return rankedArticles;

            } finally {
                this.activeScoringJobs.delete(jobId);
            }

        } catch (error) {
            console.error(`[ArticleScoring] Failed for request ${requestId}:`, error.message);
            
            metricsLogger.logSystemError('article-scoring-failed', {
                requestId,
                error: error.message,
                articlesCount: articles.length
            });

            throw error;
        }
    }

    /**
     * Score articles using multiple methods
     * @param {Array} articles - Articles to score
     * @param {string} requestId - Request ID
     * @returns {Promise<Array>} Articles with scores
     */
    async scoreArticles(articles, requestId) {
        const scoredArticles = [];

        for (const article of articles) {
            try {
                const scores = await this.calculateArticleScores(article, requestId);
                const overallScore = this.calculateOverallScore(scores);
                
                scoredArticles.push({
                    ...article,
                    scores,
                    helpfulnessScore: overallScore,
                    scoredAt: new Date().toISOString()
                });

            } catch (error) {
                console.warn(`[ArticleScoring] Failed to score article "${article.title}":`, error.message);
                
                // Add article with default scores
                scoredArticles.push({
                    ...article,
                    scores: { error: error.message },
                    helpfulnessScore: 0,
                    scoredAt: new Date().toISOString()
                });
            }
        }

        return scoredArticles;
    }

    /**
     * Calculate scores for a single article
     * @param {Object} article - Article to score
     * @param {string} requestId - Request ID
     * @returns {Promise<Object>} Article scores
     */
    async calculateArticleScores(article, requestId) {
        const scores = {
            titleLength: this.scoreTitleLength(article.title),
            contentQuality: this.scoreContentQuality(article),
            recency: this.scoreRecency(article),
            engagement: this.scoreEngagement(article),
            relevance: this.scoreRelevance(article)
        };

        // Add AI scoring if available
        if (aiScoringService.isAvailable()) {
            try {
                const aiScore = await this.getAIScore(article, requestId);
                scores.aiAnalysis = aiScore;
            } catch (error) {
                console.warn(`[ArticleScoring] AI scoring failed for article "${article.title}":`, error.message);
                scores.aiAnalysis = { error: error.message };
            }
        }

        return scores;
    }

    /**
     * Score based on title length
     * @param {string} title - Article title
     * @returns {number} Score (0-10)
     */
    scoreTitleLength(title) {
        if (!title) return 0;
        
        const length = title.length;
        if (length < 10) return 2;
        if (length < 30) return 8;
        if (length < 80) return 10;
        if (length < 120) return 7;
        return 4; // Too long
    }

    /**
     * Score based on content quality indicators
     * @param {Object} article - Article data
     * @returns {number} Score (0-10)
     */
    scoreContentQuality(article) {
        let score = 5; // Base score

        // Check for quality indicators
        if (article.title && article.title.length > 20) score += 1;
        if (article.summary && article.summary.length > 50) score += 1;
        if (article.url && article.url.includes('http')) score += 1;
        if (article.author && article.author.length > 0) score += 1;
        if (article.category && article.category.length > 0) score += 1;

        return Math.min(10, score);
    }

    /**
     * Score based on recency
     * @param {Object} article - Article data
     * @returns {number} Score (0-10)
     */
    scoreRecency(article) {
        if (!article.timeText) return 5;

        const timeText = article.timeText.toLowerCase();
        
        if (timeText.includes('minute')) return 10;
        if (timeText.includes('hour')) return 9;
        if (timeText.includes('day')) return 7;
        if (timeText.includes('week')) return 4;
        if (timeText.includes('month')) return 2;
        if (timeText.includes('year')) return 1;
        
        return 5; // Unknown time
    }

    /**
     * Score based on engagement indicators
     * @param {Object} article - Article data
     * @returns {number} Score (0-10)
     */
    scoreEngagement(article) {
        let score = 5; // Base score

        // Simulate engagement scoring based on available data
        if (article.comments && article.comments > 0) score += 1;
        if (article.points && article.points > 10) score += 1;
        if (article.views && article.views > 100) score += 1;
        if (article.shares && article.shares > 5) score += 1;

        return Math.min(10, score);
    }

    /**
     * Score based on relevance
     * @param {Object} article - Article data
     * @returns {number} Score (0-10)
     */
    scoreRelevance(article) {
        if (!article.title) return 5;

        const title = article.title.toLowerCase();
        const techKeywords = [
            'javascript', 'python', 'react', 'node', 'api', 'web', 'development',
            'programming', 'code', 'software', 'tech', 'ai', 'machine learning',
            'data', 'algorithm', 'framework', 'database', 'cloud', 'security'
        ];

        const keywordCount = techKeywords.filter(keyword => 
            title.includes(keyword)
        ).length;

        return Math.min(10, 5 + keywordCount);
    }

    /**
     * Get AI score for article
     * @param {Object} article - Article data
     * @param {string} requestId - Request ID
     * @returns {Promise<Object>} AI score
     */
    async getAIScore(article, requestId) {
        const prompt = `Analyze this article and provide a helpfulness score (1-10):

Title: ${article.title || 'No title'}
Summary: ${article.summary || 'No summary'}
Time: ${article.timeText || 'Unknown'}

Provide a JSON response with:
- helpfulnessScore: number (1-10)
- reasoning: string
- confidence: number (1-10)`;

        try {
            const aiResponse = await aiScoringService.callOpenAI(prompt, requestId);
            const parsed = JSON.parse(aiResponse);
            
            return {
                score: parsed.helpfulnessScore || 5,
                reasoning: parsed.reasoning || 'AI analysis completed',
                confidence: parsed.confidence || 5
            };
        } catch (error) {
            return {
                score: 5,
                reasoning: 'AI analysis failed',
                confidence: 1,
                error: error.message
            };
        }
    }

    /**
     * Calculate overall score from individual scores
     * @param {Object} scores - Individual scores
     * @returns {number} Overall score
     */
    calculateOverallScore(scores) {
        const weights = {
            titleLength: 0.15,
            contentQuality: 0.25,
            recency: 0.20,
            engagement: 0.20,
            relevance: 0.20
        };

        let weightedSum = 0;
        let totalWeight = 0;

        Object.keys(weights).forEach(key => {
            if (scores[key] !== undefined) {
                weightedSum += scores[key] * weights[key];
                totalWeight += weights[key];
            }
        });

        // Add AI score if available
        if (scores.aiAnalysis && scores.aiAnalysis.score !== undefined) {
            weightedSum += scores.aiAnalysis.score * 0.3;
            totalWeight += 0.3;
        }

        return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
    }

    /**
     * Rank articles by score
     * @param {Array} articles - Articles with scores
     * @returns {Array} Ranked articles
     */
    rankArticlesByScore(articles) {
        return articles.sort((a, b) => {
            // Primary sort by helpfulness score
            if (b.helpfulnessScore !== a.helpfulnessScore) {
                return b.helpfulnessScore - a.helpfulnessScore;
            }
            
            // Secondary sort by recency
            const aRecency = a.scores?.recency || 0;
            const bRecency = b.scores?.recency || 0;
            return bRecency - aRecency;
        });
    }

    /**
     * Generate cache key for articles
     * @param {Array} articles - Articles array
     * @returns {string} Cache key
     */
    generateCacheKey(articles) {
        const titles = articles.map(a => a.title || '').join('|');
        return this.hashString(titles);
    }

    /**
     * Get cached result
     * @param {string} key - Cache key
     * @returns {Array|null} Cached result
     */
    getCachedResult(key) {
        const cached = this.scoringCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cached result
     * @param {string} key - Cache key
     * @param {Array} data - Data to cache
     */
    setCachedResult(key, data) {
        this.scoringCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Hash string for cache key
     * @param {string} str - String to hash
     * @returns {string} Hashed string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    generateRequestId() {
        return `scoring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get service statistics
     * @returns {Object} Service statistics
     */
    getStats() {
        return {
            cacheSize: this.scoringCache.size,
            activeJobs: this.activeScoringJobs.size,
            maxConcurrentJobs: this.maxConcurrentJobs,
            cacheExpiry: this.cacheExpiry,
            aiServiceAvailable: aiScoringService.isAvailable()
        };
    }

    /**
     * Clear scoring cache
     */
    clearCache() {
        this.scoringCache.clear();
    }
}

// Create singleton instance
const articleScoringService = new ArticleScoringService();

module.exports = {
    articleScoringService,
    ArticleScoringServiceError
};