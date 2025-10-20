const { randomUUID } = require('crypto');

const rankingHistory = new Map();
const rankingOrder = [];
const feedbackEntries = [];
const aiInsights = new Map();
let currentRankingId = null;
const MAX_RANKINGS_STORED = 20;

function pruneHistoryIfNeeded() {
    while (rankingOrder.length > MAX_RANKINGS_STORED) {
        const oldestId = rankingOrder.shift();
        if (oldestId) {
            rankingHistory.delete(oldestId);
            aiInsights.delete(oldestId);
        }
    }
}

function createRankingRecord({ url, totalArticles, pagesNavigated, isCorrectlySorted, articles }) {
    const id = randomUUID();
    const generatedAt = new Date().toISOString();
    const record = {
        id,
        url,
        totalArticles,
        pagesNavigated,
        isCorrectlySorted,
        articles,
        generatedAt
    };

    rankingHistory.set(id, record);
    rankingOrder.push(id);
    currentRankingId = id;
    pruneHistoryIfNeeded();

    return record;
}

function getCurrentRanking() {
    return currentRankingId ? rankingHistory.get(currentRankingId) : null;
}

function getRankingById(id) {
    return rankingHistory.get(id) || null;
}

function listRankings() {
    return rankingOrder
        .slice()
        .reverse()
        .map((id) => rankingHistory.get(id))
        .filter(Boolean);
}

function addFeedback({ rankingId, articlePosition, vote, notes }) {
    const feedback = {
        id: randomUUID(),
        rankingId,
        articlePosition,
        vote,
        notes: notes || '',
        submittedAt: new Date().toISOString()
    };
    feedbackEntries.push(feedback);
    return feedback;
}

function listFeedback({ rankingId } = {}) {
    let entries = feedbackEntries.slice();
    if (rankingId) {
        entries = entries.filter((entry) => entry.rankingId === rankingId);
    }
    return entries.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

function saveAIInsight(rankingId, insight) {
    if (!rankingHistory.has(rankingId)) {
        return null;
    }

    const record = {
        ...insight,
        rankingId,
        recordedAt: new Date().toISOString()
    };

    aiInsights.set(rankingId, record);
    return record;
}

function getAIInsight(rankingId) {
    return aiInsights.get(rankingId) || null;
}

module.exports = {
    createRankingRecord,
    getCurrentRanking,
    getRankingById,
    listRankings,
    addFeedback,
    listFeedback,
    saveAIInsight,
    getAIInsight
};
