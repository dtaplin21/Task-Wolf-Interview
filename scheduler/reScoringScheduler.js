const rankingStore = require('../services/rankingStore');
const aiScoringService = require('../services/aiScoringService');
const metricsLogger = require('../utils/metricsLogger');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let intervalHandle = null;

async function runRescoreOnce() {
    const ranking = rankingStore.getCurrentRanking();
    if (!ranking) {
        metricsLogger.logSystemEvent('ai-rescore-skipped', { reason: 'no-ranking-available' });
        return;
    }

    try {
        const aiResult = await aiScoringService.requestAIScoring(ranking);
        rankingStore.saveAIInsight(ranking.id, aiResult);
        metricsLogger.logSystemEvent('ai-rescore-success', {
            rankingId: ranking.id,
            requestId: aiResult.requestId,
            latencyMs: aiResult.latencyMs
        });
    } catch (error) {
        metricsLogger.logSystemError('ai-rescore-failed', {
            message: error.message,
            rankingId: ranking.id
        });
    }
}

function startReScoringScheduler({ intervalMs } = {}) {
    const scheduleInterval = intervalMs || Number(process.env.AI_RESCORE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

    if (intervalHandle) {
        clearInterval(intervalHandle);
    }

    metricsLogger.logSystemEvent('ai-rescore-scheduled', {
        intervalMs: scheduleInterval
    });

    intervalHandle = setInterval(runRescoreOnce, scheduleInterval);
    return {
        stop() {
            if (intervalHandle) {
                clearInterval(intervalHandle);
                intervalHandle = null;
            }
        },
        runNow: runRescoreOnce
    };
}

module.exports = {
    startReScoringScheduler,
    runRescoreOnce
};
