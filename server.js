// Express server to serve the frontend and run the web scraper
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

// Import all required modules
const config = require('./config/config');
const rankingStore = require('./services/rankingStore');
const aiScoringService = require('./services/aiScoringService');
const metricsLogger = require('./utils/metricsLogger');
const { startReScoringScheduler } = require('./scheduler/reScoringScheduler');
const articleRepository = require('./src/data/articles');
const { authenticateRequest } = require('./middleware/authenticate');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { articleScoringService } = require('./services/articleScoringService');

const app = express();
const PORT = config.getPort();
const FEEDBACK_VOTES = new Set(['promote', 'demote', 'correct']);

// Print configuration help if OpenAI is not configured
if (!config.isOpenAIConfigured()) {
    config.printHelp();
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Get system status and configuration
 */
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        server: {
            port: PORT,
            nodeEnv: config.getNodeEnv(),
            uptime: process.uptime()
        },
        openai: {
            configured: config.isOpenAIConfigured(),
            aiScoringAvailable: aiScoringService.isAvailable()
        },
        services: {
            aiScoring: aiScoringService.getStatus()
        },
        config: config.getStatus()
    });
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
 * Get hacking-focused analysis of articles
 */
app.post('/api/ai/hacking-analysis', async (req, res) => {
    try {
        const { rankingId } = req.body || {};
        const ranking = rankingId ? rankingStore.getRankingById(rankingId) : rankingStore.getCurrentRanking();

        if (!ranking) {
            return res.status(404).json({ 
                success: false, 
                error: 'No ranking available for hacking analysis' 
            });
        }

        if (!aiScoringService.isAvailable()) {
            return res.status(503).json({ 
                success: false, 
                error: 'AI service not available. Please configure OpenAI API key.' 
            });
        }

        console.log(`[API] Starting hacking analysis for ranking ${ranking.id}`);
        
        const hackingResult = await aiScoringService.requestHackingAnalysis(ranking);
        
        // Save the hacking analysis separately
        rankingStore.saveAIInsight(ranking.id, {
            ...hackingResult,
            analysisType: 'hacking-focused'
        });

        metricsLogger.logSystemEvent('hacking-analysis-completed', {
            rankingId: ranking.id,
            requestId: hackingResult.requestId,
            articlesAnalyzed: hackingResult.articlesAnalyzed
        });

        res.json({ 
            success: true, 
            rankingId: ranking.id, 
            hackingAnalysis: hackingResult,
            topHackingArticles: hackingResult.analysis?.topArticles || [],
            securityInsights: hackingResult.analysis?.securityInsights || 'No insights available',
            recommendedFocus: hackingResult.analysis?.recommendedFocus || 'Manual review recommended'
        });

    } catch (error) {
        console.error('[API] Hacking analysis failed:', error.message);
        metricsLogger.logSystemError('hacking-analysis-endpoint-failed', { 
            message: error.message 
        });
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
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
 * Get ranked articles endpoint
 */
app.get('/api/articles/ranked', (req, res) => {
    try {
        const ranking = rankingStore.getCurrentRanking();
        
        if (!ranking) {
            return res.json({
                success: true,
                articles: []
            });
        }

        // Transform articles for frontend
        const rankedArticles = ranking.articles.map((article, index) => ({
            title: article.title,
            url: article.url || '#',
            score: article.score || Math.max(1, 100 - index), // Generate score based on position
            position: index + 1,
            timeText: article.timeText,
            page: article.page
        }));

        res.json({
            success: true,
            articles: rankedArticles,
            rankingId: ranking.id,
            totalArticles: ranking.totalArticles
        });

    } catch (error) {
        console.error('Failed to get ranked articles:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve ranked articles'
        });
    }
});

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