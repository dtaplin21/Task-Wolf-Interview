// Article Repository for data persistence
const fs = require('fs').promises;
const path = require('path');

class ArticleRepository {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.articlesFile = path.join(this.dataDir, 'articles.json');
        this.metadataFile = path.join(this.dataDir, 'metadata.json');
        this.ensureDataDirectory();
    }

    /**
     * Ensure data directory exists
     */
    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create data directory:', error.message);
        }
    }

    /**
     * Save articles and metadata
     * @param {Object} data - Articles and metadata
     */
    async saveArticles(data) {
        try {
            const timestamp = new Date().toISOString();
            const articleRecord = {
                id: this.generateId(),
                timestamp,
                articles: data.articles || [],
                metadata: data.metadata || {},
                createdAt: timestamp
            };

            // Read existing articles
            const existingArticles = await this.loadArticles();
            
            // Add new record
            existingArticles.push(articleRecord);

            // Keep only recent records (last 100)
            const recentArticles = existingArticles
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 100);

            // Save to file
            await fs.writeFile(
                this.articlesFile, 
                JSON.stringify(recentArticles, null, 2)
            );

            console.log(`[ArticleRepository] Saved ${data.articles?.length || 0} articles`);
            
        } catch (error) {
            console.error('[ArticleRepository] Failed to save articles:', error.message);
            throw error;
        }
    }

    /**
     * Load all articles
     * @returns {Array} All article records
     */
    async loadArticles() {
        try {
            const data = await fs.readFile(this.articlesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File doesn't exist yet
            }
            console.error('[ArticleRepository] Failed to load articles:', error.message);
            return [];
        }
    }

    /**
     * Get latest articles
     * @param {number} limit - Maximum number of records
     * @returns {Array} Latest article records
     */
    async getLatestArticles(limit = 10) {
        const allArticles = await this.loadArticles();
        return allArticles
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    /**
     * Get articles by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Articles in date range
     */
    async getArticlesByDateRange(startDate, endDate) {
        const allArticles = await this.loadArticles();
        return allArticles.filter(record => {
            const recordDate = new Date(record.createdAt);
            return recordDate >= startDate && recordDate <= endDate;
        });
    }

    /**
     * Get article statistics
     * @returns {Object} Statistics
     */
    async getStatistics() {
        const allArticles = await this.loadArticles();
        
        const stats = {
            totalRecords: allArticles.length,
            totalArticles: 0,
            averageArticlesPerRecord: 0,
            dateRange: {
                earliest: null,
                latest: null
            },
            bySource: {}
        };

        if (allArticles.length === 0) {
            return stats;
        }

        // Calculate statistics
        allArticles.forEach(record => {
            stats.totalArticles += record.articles?.length || 0;
            
            // Track date range
            const recordDate = new Date(record.createdAt);
            if (!stats.dateRange.earliest || recordDate < stats.dateRange.earliest) {
                stats.dateRange.earliest = record.createdAt;
            }
            if (!stats.dateRange.latest || recordDate > stats.dateRange.latest) {
                stats.dateRange.latest = record.createdAt;
            }

            // Track by source URL
            const sourceUrl = record.metadata?.url || 'unknown';
            stats.bySource[sourceUrl] = (stats.bySource[sourceUrl] || 0) + 1;
        });

        stats.averageArticlesPerRecord = stats.totalRecords > 0 
            ? Math.round(stats.totalArticles / stats.totalRecords) 
            : 0;

        return stats;
    }

    /**
     * Search articles by title
     * @param {string} query - Search query
     * @param {number} limit - Maximum results
     * @returns {Array} Matching articles
     */
    async searchArticles(query, limit = 50) {
        const allArticles = await this.loadArticles();
        const results = [];

        const searchTerm = query.toLowerCase();

        allArticles.forEach(record => {
            if (!record.articles) return;

            record.articles.forEach(article => {
                if (article.title && article.title.toLowerCase().includes(searchTerm)) {
                    results.push({
                        ...article,
                        recordId: record.id,
                        recordCreatedAt: record.createdAt
                    });
                }
            });
        });

        return results
            .sort((a, b) => new Date(b.recordCreatedAt) - new Date(a.recordCreatedAt))
            .slice(0, limit);
    }

    /**
     * Get articles by source URL
     * @param {string} url - Source URL
     * @returns {Array} Articles from source
     */
    async getArticlesBySource(url) {
        const allArticles = await this.loadArticles();
        return allArticles.filter(record => 
            record.metadata?.url === url
        );
    }

    /**
     * Delete old articles
     * @param {number} maxAge - Maximum age in milliseconds
     */
    async cleanupOldArticles(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        try {
            const allArticles = await this.loadArticles();
            const cutoff = new Date(Date.now() - maxAge);
            
            const recentArticles = allArticles.filter(record => 
                new Date(record.createdAt) >= cutoff
            );

            if (recentArticles.length !== allArticles.length) {
                await fs.writeFile(
                    this.articlesFile, 
                    JSON.stringify(recentArticles, null, 2)
                );
                
                console.log(`[ArticleRepository] Cleaned up ${allArticles.length - recentArticles.length} old records`);
            }
        } catch (error) {
            console.error('[ArticleRepository] Failed to cleanup old articles:', error.message);
        }
    }

    /**
     * Export articles to JSON
     * @param {string} outputPath - Output file path
     */
    async exportArticles(outputPath) {
        try {
            const articles = await this.loadArticles();
            await fs.writeFile(outputPath, JSON.stringify(articles, null, 2));
            console.log(`[ArticleRepository] Exported ${articles.length} records to ${outputPath}`);
        } catch (error) {
            console.error('[ArticleRepository] Failed to export articles:', error.message);
            throw error;
        }
    }

    /**
     * Import articles from JSON
     * @param {string} inputPath - Input file path
     */
    async importArticles(inputPath) {
        try {
            const data = await fs.readFile(inputPath, 'utf8');
            const articles = JSON.parse(data);
            
            if (Array.isArray(articles)) {
                await fs.writeFile(this.articlesFile, JSON.stringify(articles, null, 2));
                console.log(`[ArticleRepository] Imported ${articles.length} records from ${inputPath}`);
            } else {
                throw new Error('Invalid articles format');
            }
        } catch (error) {
            console.error('[ArticleRepository] Failed to import articles:', error.message);
            throw error;
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `article-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get repository status
     * @returns {Object} Repository status
     */
    async getStatus() {
        try {
            const stats = await this.getStatistics();
            const fileStats = await fs.stat(this.articlesFile).catch(() => null);
            
            return {
                dataDirectory: this.dataDir,
                articlesFile: this.articlesFile,
                fileExists: !!fileStats,
                fileSize: fileStats?.size || 0,
                lastModified: fileStats?.mtime || null,
                statistics: stats
            };
        } catch (error) {
            return {
                dataDirectory: this.dataDir,
                articlesFile: this.articlesFile,
                fileExists: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const articleRepository = new ArticleRepository();

module.exports = articleRepository;