// Re-scoring Scheduler for periodic AI analysis
const aiScoringService = require('../services/aiScoringService');
const rankingStore = require('../services/rankingStore');
const metricsLogger = require('../utils/metricsLogger');

class ReScoringScheduler {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.intervalMs = 30 * 60 * 1000; // 30 minutes default
        this.maxConcurrentJobs = 2;
        this.activeJobs = new Set();
    }

    /**
     * Start the re-scoring scheduler
     * @param {number} intervalMs - Interval in milliseconds
     */
    start(intervalMs = this.intervalMs) {
        if (this.isRunning) {
            console.log('[Scheduler] Already running');
            return;
        }

        this.intervalMs = intervalMs;
        this.isRunning = true;

        console.log(`[Scheduler] Starting re-scoring scheduler (interval: ${intervalMs}ms)`);
        
        // Run immediately on start
        this.runReScoringCycle();
        
        // Schedule periodic runs
        this.intervalId = setInterval(() => {
            this.runReScoringCycle();
        }, this.intervalMs);

        metricsLogger.logSystemEvent('scheduler-started', {
            intervalMs: this.intervalMs,
            maxConcurrentJobs: this.maxConcurrentJobs
        });
    }

    /**
     * Stop the re-scoring scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.log('[Scheduler] Not running');
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        console.log('[Scheduler] Stopped');
        metricsLogger.logSystemEvent('scheduler-stopped');
    }

    /**
     * Run a complete re-scoring cycle
     */
    async runReScoringCycle() {
        if (this.activeJobs.size >= this.maxConcurrentJobs) {
            console.log('[Scheduler] Max concurrent jobs reached, skipping cycle');
            return;
        }

        const cycleId = this.generateCycleId();
        console.log(`[Scheduler] Starting re-scoring cycle ${cycleId}`);

        try {
            // Get rankings that need re-scoring
            const rankingsToRescore = this.getRankingsForReScoring();
            
            if (rankingsToRescore.length === 0) {
                console.log('[Scheduler] No rankings need re-scoring');
                return;
            }

            console.log(`[Scheduler] Found ${rankingsToRescore.length} rankings to re-score`);

            // Process rankings in parallel (up to maxConcurrentJobs)
            const jobs = rankingsToRescore.slice(0, this.maxConcurrentJobs).map(ranking => 
                this.processRankingReScoring(ranking, cycleId)
            );

            await Promise.allSettled(jobs);

            metricsLogger.logSystemEvent('rescoring-cycle-completed', {
                cycleId,
                rankingsProcessed: rankingsToRescore.length,
                activeJobs: this.activeJobs.size
            });

        } catch (error) {
            console.error(`[Scheduler] Cycle ${cycleId} failed:`, error.message);
            metricsLogger.logSystemError('rescoring-cycle-failed', {
                cycleId,
                error: error.message
            });
        }
    }

    /**
     * Process re-scoring for a single ranking
     * @param {Object} ranking - Ranking to re-score
     * @param {string} cycleId - Cycle ID
     */
    async processRankingReScoring(ranking, cycleId) {
        const jobId = `${cycleId}-${ranking.id}`;
        this.activeJobs.add(jobId);

        try {
            console.log(`[Scheduler] Processing ranking ${ranking.id} (job: ${jobId})`);

            // Check if AI service is available
            if (!aiScoringService.isAvailable()) {
                console.log(`[Scheduler] AI service not available, skipping ranking ${ranking.id}`);
                return;
            }

            // Check if ranking already has recent AI insight
            const existingInsight = rankingStore.getAIInsight(ranking.id);
            if (this.hasRecentInsight(existingInsight)) {
                console.log(`[Scheduler] Ranking ${ranking.id} has recent insight, skipping`);
                return;
            }

            // Request AI re-scoring
            const aiResult = await aiScoringService.requestAIScoring(ranking);
            
            // Save the result
            rankingStore.saveAIInsight(ranking.id, aiResult);

            console.log(`[Scheduler] Completed re-scoring for ranking ${ranking.id}`);
            
            metricsLogger.logSystemEvent('ranking-rescored', {
                rankingId: ranking.id,
                jobId,
                success: aiResult.success,
                requestId: aiResult.requestId
            });

        } catch (error) {
            console.error(`[Scheduler] Failed to re-score ranking ${ranking.id}:`, error.message);
            metricsLogger.logSystemError('ranking-rescore-failed', {
                rankingId: ranking.id,
                jobId,
                error: error.message
            });
        } finally {
            this.activeJobs.delete(jobId);
        }
    }

    /**
     * Get rankings that need re-scoring
     * @returns {Array} Rankings to re-score
     */
    getRankingsForReScoring() {
        const allRankings = rankingStore.getAllRankings();
        const now = new Date();
        const rescoreThreshold = 2 * 60 * 60 * 1000; // 2 hours

        return allRankings.filter(ranking => {
            // Skip if no articles
            if (!ranking.articles || ranking.articles.length === 0) {
                return false;
            }

            // Check existing AI insight
            const existingInsight = rankingStore.getAIInsight(ranking.id);
            if (existingInsight) {
                const insightAge = now - new Date(existingInsight.generatedAt);
                return insightAge > rescoreThreshold;
            }

            // No existing insight, needs initial scoring
            return true;
        });
    }

    /**
     * Check if insight is recent enough
     * @param {Object} insight - AI insight
     * @returns {boolean} True if recent
     */
    hasRecentInsight(insight) {
        if (!insight) {
            return false;
        }

        const now = new Date();
        const insightAge = now - new Date(insight.generatedAt);
        const threshold = 2 * 60 * 60 * 1000; // 2 hours

        return insightAge < threshold;
    }

    /**
     * Generate unique cycle ID
     * @returns {string} Cycle ID
     */
    generateCycleId() {
        return `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get scheduler status
     * @returns {Object} Scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalMs: this.intervalMs,
            maxConcurrentJobs: this.maxConcurrentJobs,
            activeJobs: this.activeJobs.size,
            activeJobIds: Array.from(this.activeJobs),
            nextRun: this.isRunning ? new Date(Date.now() + this.intervalMs).toISOString() : null
        };
    }

    /**
     * Force immediate re-scoring cycle
     */
    async forceCycle() {
        console.log('[Scheduler] Forcing immediate re-scoring cycle');
        await this.runReScoringCycle();
    }

    /**
     * Update scheduler configuration
     * @param {Object} config - Configuration options
     */
    updateConfig(config) {
        if (config.intervalMs && config.intervalMs > 0) {
            this.intervalMs = config.intervalMs;
        }

        if (config.maxConcurrentJobs && config.maxConcurrentJobs > 0) {
            this.maxConcurrentJobs = config.maxConcurrentJobs;
        }

        console.log('[Scheduler] Configuration updated:', {
            intervalMs: this.intervalMs,
            maxConcurrentJobs: this.maxConcurrentJobs
        });

        metricsLogger.logSystemEvent('scheduler-config-updated', {
            intervalMs: this.intervalMs,
            maxConcurrentJobs: this.maxConcurrentJobs
        });
    }
}

// Create singleton instance
const reScoringScheduler = new ReScoringScheduler();

/**
 * Start the re-scoring scheduler
 * @param {number} intervalMs - Interval in milliseconds
 */
function startReScoringScheduler(intervalMs = 30 * 60 * 1000) {
    reScoringScheduler.start(intervalMs);
}

/**
 * Stop the re-scoring scheduler
 */
function stopReScoringScheduler() {
    reScoringScheduler.stop();
}

/**
 * Get scheduler status
 * @returns {Object} Scheduler status
 */
function getSchedulerStatus() {
    return reScoringScheduler.getStatus();
}

module.exports = {
    startReScoringScheduler,
    stopReScoringScheduler,
    getSchedulerStatus,
    reScoringScheduler
};