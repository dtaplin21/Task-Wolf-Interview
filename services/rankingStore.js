// Ranking store for managing article rankings and feedback
class RankingStore {
    constructor() {
        this.rankings = new Map();
        this.feedback = new Map();
        this.currentRankingId = null;
    }

    /**
     * Create a new ranking record
     * @param {Object} data - Ranking data
     * @returns {Object} Created ranking record
     */
    createRankingRecord(data) {
        const id = this.generateId();
        const ranking = {
            id,
            generatedAt: new Date().toISOString(),
            url: data.url,
            totalArticles: data.totalArticles || 0,
            pagesNavigated: data.pagesNavigated || 0,
            isCorrectlySorted: data.isCorrectlySorted || false,
            articles: data.articles || [],
            createdAt: new Date().toISOString()
        };

        this.rankings.set(id, ranking);
        this.currentRankingId = id;
        return ranking;
    }

    /**
     * Get ranking by ID
     * @param {string} id - Ranking ID
     * @returns {Object|null} Ranking record
     */
    getRankingById(id) {
        return this.rankings.get(id) || null;
    }

    /**
     * Get the current ranking
     * @returns {Object|null} Current ranking record
     */
    getCurrentRanking() {
        if (!this.currentRankingId) {
            return null;
        }
        return this.getRankingById(this.currentRankingId);
    }

    /**
     * Save AI insight for a ranking
     * @param {string} rankingId - Ranking ID
     * @param {Object} aiResult - AI scoring result
     */
    saveAIInsight(rankingId, aiResult) {
        const ranking = this.getRankingById(rankingId);
        if (ranking) {
            ranking.aiInsight = {
                ...aiResult,
                generatedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Get AI insight for a ranking
     * @param {string} rankingId - Ranking ID
     * @returns {Object|null} AI insight
     */
    getAIInsight(rankingId) {
        const ranking = this.getRankingById(rankingId);
        return ranking?.aiInsight || null;
    }

    /**
     * Add feedback for a ranking
     * @param {Object} feedbackData - Feedback data
     * @returns {Object} Created feedback record
     */
    addFeedback(feedbackData) {
        const id = this.generateId();
        const feedback = {
            id,
            rankingId: feedbackData.rankingId,
            articlePosition: feedbackData.articlePosition,
            vote: feedbackData.vote,
            notes: feedbackData.notes || '',
            submittedAt: new Date().toISOString()
        };

        if (!this.feedback.has(feedbackData.rankingId)) {
            this.feedback.set(feedbackData.rankingId, []);
        }
        this.feedback.get(feedbackData.rankingId).push(feedback);
        
        return feedback;
    }

    /**
     * List feedback entries
     * @param {Object} filters - Filter options
     * @returns {Array} Feedback entries
     */
    listFeedback(filters = {}) {
        if (filters.rankingId) {
            return this.feedback.get(filters.rankingId) || [];
        }

        // Return all feedback entries
        const allFeedback = [];
        for (const feedbackList of this.feedback.values()) {
            allFeedback.push(...feedbackList);
        }
        return allFeedback.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get all rankings
     * @returns {Array} All ranking records
     */
    getAllRankings() {
        return Array.from(this.rankings.values()).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    /**
     * Clear old rankings (keep only recent ones)
     * @param {number} maxAge - Maximum age in milliseconds
     */
    cleanupOldRankings(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const cutoff = new Date(Date.now() - maxAge);
        
        for (const [id, ranking] of this.rankings.entries()) {
            if (new Date(ranking.createdAt) < cutoff) {
                this.rankings.delete(id);
                this.feedback.delete(id);
                
                if (this.currentRankingId === id) {
                    this.currentRankingId = null;
                }
            }
        }
    }
}

// Create singleton instance
const rankingStore = new RankingStore();

module.exports = rankingStore;