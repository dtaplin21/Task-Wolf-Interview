// Express server to serve the frontend and run the Hacker News scraper
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
            res.json({
                success: true,
                ...results,
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

/**
 * Start the server
 */
app.listen(PORT, () => {
    console.log(`🚀 Hacker News Scraper server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoint available at http://localhost:${PORT}/api/scrape`);
    console.log(`🏥 Health check available at http://localhost:${PORT}/api/health`);
});

module.exports = app;
