// AI Scoring Service for article ranking and analysis
const config = require('../config/config');

class AIScoringService {
    constructor() {
        this.apiKey = config.getOpenAIAPIKey();
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-3.5-turbo';
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Request AI scoring for a ranking
     * @param {Object} ranking - Ranking data
     * @returns {Promise<Object>} AI scoring result
     */
    async requestAIScoring(ranking) {
        const requestId = this.generateRequestId();
        
        try {
            console.log(`[AI Scoring] Starting analysis for ranking ${ranking.id}`);
            console.log(`[AI Scoring] Ranking data:`, JSON.stringify(ranking, null, 2));
            
            // Check if ranking has articles
            if (!ranking.articles || ranking.articles.length === 0) {
                console.warn(`[AI Scoring] No articles found in ranking ${ranking.id}`);
                return {
                    requestId,
                    rankingId: ranking.id,
                    error: 'No articles available for analysis',
                    generatedAt: new Date().toISOString(),
                    model: this.model,
                    success: false
                };
            }
            
            // Prepare articles for AI analysis
            const articlesForAnalysis = ranking.articles.slice(0, 20).map((article, index) => ({
                position: index + 1,
                title: article.title,
                timeText: article.timeText,
                page: article.page
            }));
            
            console.log(`[AI Scoring] Prepared ${articlesForAnalysis.length} articles for analysis`);

            // Create AI prompt
            const prompt = this.createAnalysisPrompt(articlesForAnalysis, ranking.url);
            
            // Call OpenAI API
            const aiResponse = await this.callOpenAI(prompt, requestId);
            
            // Parse AI response
            const analysis = this.parseAIResponse(aiResponse);
            
            const result = {
                requestId,
                rankingId: ranking.id,
                analysis,
                articlesAnalyzed: articlesForAnalysis.length,
                generatedAt: new Date().toISOString(),
                model: this.model,
                success: true
            };

            console.log(`[AI Scoring] Completed analysis for ranking ${ranking.id}`);
            return result;

        } catch (error) {
            console.error(`[AI Scoring] Failed for ranking ${ranking.id}:`, error.message);
            
            return {
                requestId,
                rankingId: ranking.id,
                error: error.message,
                generatedAt: new Date().toISOString(),
                model: this.model,
                success: false
            };
        }
    }

    /**
     * Request hacking-focused AI analysis for a ranking
     * @param {Object} ranking - Ranking data
     * @returns {Promise<Object>} Hacking-focused AI analysis result
     */
    async requestHackingAnalysis(ranking) {
        const requestId = this.generateRequestId();
        
        try {
            console.log(`[AI Hacking Analysis] Starting security analysis for ranking ${ranking.id}`);
            console.log(`[AI Hacking Analysis] Ranking data:`, JSON.stringify(ranking, null, 2));
            
            // Check if ranking has articles
            if (!ranking.articles || ranking.articles.length === 0) {
                console.warn(`[AI Hacking Analysis] No articles found in ranking ${ranking.id}`);
                return {
                    requestId,
                    rankingId: ranking.id,
                    analysisType: 'hacking-focused',
                    error: 'No articles available for analysis',
                    generatedAt: new Date().toISOString(),
                    success: false
                };
            }
            
            // Prepare articles for AI analysis
            const articlesForAnalysis = ranking.articles.slice(0, 30).map((article, index) => ({
                position: index + 1,
                title: article.title,
                timeText: article.timeText,
                page: article.page
            }));
            
            console.log(`[AI Hacking Analysis] Prepared ${articlesForAnalysis.length} articles for analysis`);

            // Create hacking-focused AI prompt
            const prompt = this.createHackingAnalysisPrompt(articlesForAnalysis, ranking.url);
            
            // Call OpenAI API
            const aiResponse = await this.callOpenAI(prompt, requestId);
            
            // Parse AI response
            const analysis = this.parseHackingResponse(aiResponse);
            
            const result = {
                requestId,
                rankingId: ranking.id,
                analysisType: 'hacking-focused',
                analysis,
                articlesAnalyzed: articlesForAnalysis.length,
                generatedAt: new Date().toISOString(),
                model: this.model,
                success: true
            };

            console.log(`[AI Hacking Analysis] Completed security analysis for ranking ${ranking.id}`);
            return result;

        } catch (error) {
            console.error(`[AI Hacking Analysis] Failed for ranking ${ranking.id}:`, error.message);
            
            return {
                requestId,
                rankingId: ranking.id,
                analysisType: 'hacking-focused',
                error: error.message,
                generatedAt: new Date().toISOString(),
                model: this.model,
                success: false
            };
        }
    }

    /**
     * Create analysis prompt for AI
     * @param {Array} articles - Articles to analyze
     * @param {string} url - Source URL
     * @returns {string} AI prompt
     */
    createAnalysisPrompt(articles, url) {
        const articlesText = articles.map(article => 
            `${article.position}. ${article.title} (${article.timeText})`
        ).join('\n');

        return `Analyze the following articles from ${url} and provide insights about their ranking quality:

Articles:
${articlesText}

Please provide:
1. Overall assessment of ranking quality (1-10 scale)
2. Any obvious ranking issues
3. Suggestions for improvement
4. Confidence level in the analysis (1-10 scale)

Respond in JSON format with keys: overallScore, issues, suggestions, confidenceLevel, summary.`;
    }

    /**
     * Create hacking-focused analysis prompt for AI
     * @param {Array} articles - Articles to analyze
     * @param {string} url - Source URL
     * @returns {string} AI prompt for hacking analysis
     */
    createHackingAnalysisPrompt(articles, url) {
        const articlesText = articles.map(article => 
            `${article.position}. ${article.title} (${article.timeText})`
        ).join('\n');

        return `You are a cybersecurity expert analyzing articles for hacking and security information. Analyze these articles from ${url}:

Articles:
${articlesText}

For each article, evaluate based on these hacking/security criteria:
1. **Technical Depth** (1-10): Does it contain practical hacking techniques, code examples, or detailed technical information?
2. **Security Relevance** (1-10): How relevant is it to cybersecurity, penetration testing, or ethical hacking?
3. **Practical Value** (1-10): Can the information be applied in real-world security scenarios?
4. **Learning Value** (1-10): Does it teach valuable security concepts or methodologies?
5. **Innovation Level** (1-10): Does it present new techniques, tools, or approaches?

Common hacking practices to look for:
- Vulnerability research and exploitation
- Penetration testing methodologies
- Security tool usage and development
- Cryptography and encryption techniques
- Network security and protocols
- Web application security
- Reverse engineering
- Malware analysis
- Social engineering techniques
- Incident response and forensics

Respond in JSON format with:
- topArticles: Array of top 5 articles with their scores and reasoning
- securityInsights: Overall security trends and patterns
- recommendedFocus: Which articles to prioritize for security professionals
- riskLevel: Assessment of how technical/advanced the content is (1-10)

Format each article as: {position, title, technicalDepth, securityRelevance, practicalValue, learningValue, innovationLevel, overallScore, reasoning}`;
    }

    /**
     * Call OpenAI API
     * @param {string} prompt - AI prompt
     * @param {string} requestId - Request ID
     * @returns {Promise<Object>} OpenAI response
     */
    async callOpenAI(prompt, requestId) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const payload = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert content analyst specializing in article ranking and quality assessment.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.3
        };

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                return data.choices[0]?.message?.content || '';

    } catch (error) {
                console.warn(`[AI Scoring] Attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.maxRetries) {
        throw error;
                }
                
                await this.delay(this.retryDelay * attempt);
            }
        }
    }

    /**
     * Parse AI response into structured data
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed analysis
     */
    parseAIResponse(response) {
        try {
            // Try to parse as JSON first
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback to text parsing
            return {
                summary: response,
                overallScore: this.extractScore(response),
                confidenceLevel: 5,
                issues: [],
                suggestions: []
            };

        } catch (error) {
            console.warn('[AI Scoring] Failed to parse response:', error.message);
            return {
                summary: response,
                overallScore: 5,
                confidenceLevel: 3,
                issues: ['Failed to parse AI response'],
                suggestions: ['Manual review recommended']
            };
        }
    }

    /**
     * Parse hacking-focused AI response into structured data
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed hacking analysis
     */
    parseHackingResponse(response) {
        try {
            // Try to parse as JSON first
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Ensure topArticles is properly formatted
                if (parsed.topArticles && Array.isArray(parsed.topArticles)) {
                    parsed.topArticles = parsed.topArticles.map(article => ({
                        position: article.position || 0,
                        title: article.title || 'Unknown',
                        technicalDepth: article.technicalDepth || 0,
                        securityRelevance: article.securityRelevance || 0,
                        practicalValue: article.practicalValue || 0,
                        learningValue: article.learningValue || 0,
                        innovationLevel: article.innovationLevel || 0,
                        overallScore: article.overallScore || 0,
                        reasoning: article.reasoning || 'No reasoning provided'
                    }));
                }
                
                return parsed;
            }

            // Fallback to text parsing
            return {
                topArticles: [],
                securityInsights: response,
                recommendedFocus: 'Manual review recommended',
                riskLevel: 5,
                summary: response
            };

        } catch (error) {
            console.warn('[AI Hacking Analysis] Failed to parse response:', error.message);
            return {
                topArticles: [],
                securityInsights: 'Failed to parse AI response',
                recommendedFocus: 'Manual review recommended',
                riskLevel: 5,
                error: error.message
            };
        }
    }

    /**
     * Extract score from text response
     * @param {string} text - Response text
     * @returns {number} Extracted score
     */
    extractScore(text) {
        const scoreMatch = text.match(/(\d+)(?:\/10|\s*out\s*of\s*10|\s*scale)/i);
        if (scoreMatch) {
            return Math.max(1, Math.min(10, parseInt(scoreMatch[1])));
        }
        return 5; // Default score
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    generateRequestId() {
        return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Delay utility
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if AI service is available
     * @returns {boolean} Service availability
     */
    isAvailable() {
        return config.isOpenAIConfigured();
    }

    /**
     * Get service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            available: this.isAvailable(),
            model: this.model,
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl
        };
    }
}

// Create singleton instance
const aiScoringService = new AIScoringService();

module.exports = aiScoringService;