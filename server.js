// Express server to serve the frontend and run the Hacker News scraper
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

// Combine all imports from both branches
const rankingStore = require('./services/rankingStore');
const aiScoringService = require('./services/aiScoringService');
const metricsLogger = require('./utils/metricsLogger');
const { startReScoringScheduler } = require('./scheduler/reScoringScheduler');
const articleRepository = require('./src/data/articles');
const authenticateRequest = require('./middleware/authenticate');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const articleScoringService = require('./services/articleScoringService');

const app = express();
const PORT = process.env.PORT || 3000;
const FEEDBACK_VOTES = new Set(['promote', 'demote', 'correct']);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    req.requestId = req.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    next();
});

/**
 * Serve the main HTML page
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * API endpoint to run the web scraper
 */
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }
        
        // Validate URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL format'
            });
        }
        
        console.log(`Starting scraper for URL: ${url}`);
        
        // Run the scraper script with URL parameter
        const scraperProcess = spawn('node', ['index.js', url], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        // Capture output from the scraper
        scraperProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Scraper output:', data.toString());
        });

        scraperProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('Scraper error:', data.toString());
        });

        // Wait for the process to complete
        const exitCode = await new Promise((resolve) => {
            scraperProcess.on('close', (code) => {
                resolve(code);
            });
        });

        if (exitCode === 0) {
            // Parse the output to extract structured data
            const results = parseScraperOutput(stdout);
            const rankingRecord = rankingStore.createRankingRecord({
                url,
                totalArticles: results.totalArticles,
                pagesNavigated: results.pagesNavigated,
                isCorrectlySorted: results.isCorrectlySorted,
                articles: results.articles
            });

            // Trigger an asynchronous AI re-scoring for the freshly scraped ranking
            aiScoringService
                .requestAIScoring(rankingRecord)
                .then((aiResult) => {
                    rankingStore.saveAIInsight(rankingRecord.id, aiResult);
                })
                .catch((error) => {
                    metricsLogger.logSystemError('ai-initial-rescore-failed', {
                        message: error.message,
                        rankingId: rankingRecord.id
                    });
                });

            res.json({
                success: true,
                ...results,
                rankingId: rankingRecord.id,
                rankingGeneratedAt: rankingRecord.generatedAt,
                targetUrl: url,
                rawOutput: stdout
            });
        } else {
            res.json({
                success: false,
                error: `Scraper failed with exit code ${exitCode}`,
                stderr: stderr,
                rawOutput: stdout
            });
        }

    } catch (error) {
        console.error('Error running scraper:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get the most recent ranking along with any AI insights
 */
app.get('/api/rankings/latest', (req, res) => {
    const ranking = rankingStore.getCurrentRanking();

    if (!ranking) {
        return res.status(404).json({
            success: false,
            error: 'No ranking results are available yet'
        });
    }

    res.json({
        success: true,
        ranking,
        aiInsight: rankingStore.getAIInsight(ranking.id)
    });
});

/**
 * Submit human feedback on article rankings
 */
app.post('/api/feedback', (req, res) => {
    try {
        const { rankingId, articlePosition, vote, notes } = req.body || {};

        if (!rankingId) {
            return res.status(400).json({ success: false, error: 'rankingId is required' });
        }

        const ranking = rankingStore.getRankingById(rankingId);
        if (!ranking) {
            return res.status(404).json({ success: false, error: 'Ranking not found' });
        }

        if (!FEEDBACK_VOTES.has(vote)) {
            return res.status(400).json({ success: false, error: 'vote must be promote, demote, or correct' });
        }

        const positionNumber = Number(articlePosition);
        if (!Number.isInteger(positionNumber) || positionNumber < 1 || positionNumber > ranking.articles.length) {
            return res.status(400).json({ success: false, error: 'articlePosition must be a valid article index' });
        }

        const feedback = rankingStore.addFeedback({
            rankingId,
            articlePosition: positionNumber,
            vote,
            notes
        });

        metricsLogger.logSystemEvent('feedback-received', {
            rankingId,
            articlePosition: positionNumber,
            vote
        });

        res.status(201).json({ success: true, feedback });
    } catch (error) {
        metricsLogger.logSystemError('feedback-submit-failed', { message: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * List recorded feedback entries
 */
app.get('/api/feedback', (req, res) => {
    const { rankingId } = req.query || {};
    const entries = rankingStore.listFeedback({ rankingId });
    res.json({ success: true, entries });
});

/**
 * Manually trigger an AI re-scoring
 */
app.post('/api/ai/rescore', async (req, res) => {
    try {
        const { rankingId } = req.body || {};
        const ranking = rankingId ? rankingStore.getRankingById(rankingId) : rankingStore.getCurrentRanking();

        if (!ranking) {
            return res.status(404).json({ success: false, error: 'No ranking available for re-scoring' });
        }

        const aiResult = await aiScoringService.requestAIScoring(ranking);
        rankingStore.saveAIInsight(ranking.id, aiResult);

        metricsLogger.logSystemEvent('ai-rescore-triggered', {
            rankingId: ranking.id,
            requestId: aiResult.requestId
        });

        res.json({ success: true, rankingId: ranking.id, aiResult });
    } catch (error) {
        metricsLogger.logSystemError('ai-rescore-endpoint-failed', { message: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * API endpoint to score and rank articles using the article scoring service
 */
app.post('/api/articles/score', authenticateRequest, rateLimitMiddleware, async (req, res) => {
    try {
        const { articles } = req.body || {};

        if (!Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request payload',
                details: 'The request body must include a non-empty "articles" array.'
            });
        }

        const rankedArticles = await articleScoringService.rankArticles(articles, { requestId: req.requestId });

        const serializedResults = rankedArticles.map((article) => ({
            title: article.title || '',
            summary: article.summary || '',
            helpfulnessScore: typeof article.helpfulnessScore === 'number'
                ? Number(article.helpfulnessScore)
                : 0
        }));

        return res.json({
            success: true,
            results: serializedResults,
            requestId: req.requestId
        });
    } catch (error) {
        const statusCode = error instanceof articleScoringService.ArticleScoringServiceError && error.statusCode
            ? error.statusCode
            : (error.statusCode || 502);

        return res.status(statusCode).json({
            success: false,
            error: error.message || 'Failed to score articles',
            requestId: req.requestId
        });
    }
});

/**
 * Parse the scraper output to extract structured data
 * @param {string} output - Raw output from the scraper
 * @returns {Object} Parsed results
 */
function parseScraperOutput(output) {
    const lines = output.split('\n');
    
    // Extract basic information
    const totalArticlesMatch = output.match(/Total articles analyzed: (\d+)/);
    const pagesMatch = output.match(/Pages navigated: (\d+)/);
    const successMatch = output.match(/✅ SUCCESS: Articles are correctly sorted/);
    
    const totalArticles = totalArticlesMatch ? parseInt(totalArticlesMatch[1]) : 0;
    const pagesNavigated = pagesMatch ? parseInt(pagesMatch[1]) : 0;
    const isCorrectlySorted = !!successMatch;
    
    // Extract articles (simplified parsing)
    const articles = [];
    const articleLines = lines.filter(line => line.match(/^\s*\d+\.\s+\[Page \d+\]/));
    
    articleLines.forEach(line => {
        const match = line.match(/^\s*(\d+)\.\s+\[Page (\d+)\]\s+(.+?)\s+\((.+?)\)$/);
        if (match) {
            articles.push({
                position: parseInt(match[1]),
                page: parseInt(match[2]),
                title: match[3],
                timeText: match[4]
            });
        }
    });
    
    // Extract sorting errors
    const sortingErrors = [];
    let inErrorSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('Found') && line.includes('sorting errors')) {
            inErrorSection = true;
            continue;
        }
        
        if (inErrorSection && line.includes('Error')) {
            const errorMatch = line.match(/Error (\d+) at position (\d+):/);
            if (errorMatch) {
                // Look for current and next article info
                const currentLine = lines[i + 1];
                const nextLine = lines[i + 2];
                
                if (currentLine && nextLine) {
                    const currentMatch = currentLine.match(/Current: "(.+?)" \((.+?)\)/);
                    const nextMatch = nextLine.match(/Next:\s+"(.+?)" \((.+?)\)/);
                    
                    if (currentMatch && nextMatch) {
                        sortingErrors.push({
                            position: parseInt(errorMatch[2]),
                            current: {
                                title: currentMatch[1],
                                timeText: currentMatch[2]
                            },
                            next: {
                                title: nextMatch[1],
                                timeText: nextMatch[2]
                            }
                        });
                    }
                }
            }
        }
        
        if (inErrorSection && line.includes('All') && line.includes('articles')) {
            inErrorSection = false;
        }
    }
    
    const metadata = {
        totalArticles,
        pagesNavigated,
        isCorrectlySorted,
        sortingErrors
    };

    articleRepository.saveArticles({
        articles,
        metadata
    });

    return {
        totalArticles,
        pagesNavigated,
        isCorrectlySorted,
        articles,
        sortingErrors
    };
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Hacker News Scraper API'
    });
});

// Start scheduled AI re-scoring in the background
startReScoringScheduler();

/**
 * Start the server
 */
let serverInstance = null;

function startServer(port = PORT) {
    if (serverInstance) {
        return serverInstance;
    }

    serverInstance = app.listen(port, () => {
        console.log(`🚀 Hacker News Scraper server running on http://localhost:${port}`);
        console.log(`📊 API endpoint available at http://localhost:${port}/api/scrape`);
        console.log(`🏥 Health check available at http://localhost:${port}/api/health`);
    });

    return serverInstance;
}

function stopServer() {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.stopServer = stopServer;