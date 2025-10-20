// Frontend JavaScript for Hacker News Scraper
class HackerNewsScraper {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.initializeTheme();
        this.loadRankedArticles();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.scrapeButton = document.getElementById('scrapeButton');
        this.targetUrlInput = document.getElementById('targetUrl');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsContent = document.getElementById('resultsContent');
        this.logsSection = document.getElementById('logsSection');
        this.logsContent = document.getElementById('logsContent');
        this.themeToggle = document.getElementById('themeToggle');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        this.rankedArticlesSection = document.getElementById('rankedArticlesSection');
        this.rankedArticlesList = document.getElementById('rankedArticlesList');
        this.rankedArticlesLoading = document.getElementById('rankedArticlesLoading');
        this.rankedArticlesError = document.getElementById('rankedArticlesError');
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        this.scrapeButton.addEventListener('click', () => this.startScraping());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Bind preset button events
        this.presetButtons.forEach(button => {
            button.addEventListener('click', () => this.selectPresetUrl(button));
        });
        
        // Bind input validation
        this.targetUrlInput.addEventListener('input', () => this.validateUrl());
        this.targetUrlInput.addEventListener('blur', () => this.validateUrl());
    }

    /**
     * Initialize theme from localStorage or default to light
     */
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Apply the specified theme
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    /**
     * Select a preset URL
     * @param {HTMLElement} button - The clicked preset button
     */
    selectPresetUrl(button) {
        const url = button.getAttribute('data-url');
        this.targetUrlInput.value = url;
        
        // Update active state
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Validate the URL
        this.validateUrl();
    }

    /**
     * Validate the URL input
     */
    validateUrl() {
        const url = this.targetUrlInput.value.trim();
        const isValid = this.isValidUrl(url);
        
        // Update input styling based on validation
        if (url && !isValid) {
            this.targetUrlInput.style.borderColor = 'var(--error-color)';
            this.scrapeButton.disabled = true;
        } else {
            this.targetUrlInput.style.borderColor = '';
            this.scrapeButton.disabled = false;
        }
        
        // Update preset button states
        this.presetButtons.forEach(btn => {
            const btnUrl = btn.getAttribute('data-url');
            btn.classList.toggle('active', btnUrl === url);
        });
    }

    /**
     * Check if a URL is valid
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Start the scraping process
     */
    async startScraping() {
        try {
            this.setLoadingState(true);
            this.showProgress();
            this.clearResults();
            this.clearLogs();

            // Simulate progress updates
            const targetUrl = this.targetUrlInput.value.trim();
            
            this.updateProgress(10, 'Launching browser...');
            await this.delay(500);

            this.updateProgress(25, `Navigating to ${new URL(targetUrl).hostname}...`);
            await this.delay(1000);

            this.updateProgress(40, 'Loading page content...');
            await this.delay(1500);

            this.updateProgress(60, 'Extracting data...');
            await this.delay(2000);

            this.updateProgress(80, 'Processing results...');
            await this.delay(1000);

            // Call the backend scraper
            const response = await this.callScraperAPI();
            
            this.updateProgress(100, 'Complete!');
            await this.delay(500);

            this.displayResults(response);
            this.hideProgress();

        } catch (error) {
            console.error('Scraping failed:', error);
            this.displayError(error.message);
            this.hideProgress();
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Call the backend scraper API
     * @returns {Promise<Object>} Scraping results
     */
    async callScraperAPI() {
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: this.targetUrlInput.value
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            throw new Error(`Failed to call scraper API: ${error.message}`);
        }
    }

    /**
     * Set the loading state of the scrape button
     * @param {boolean} isLoading - Whether the button should be in loading state
     */
    setLoadingState(isLoading) {
        this.scrapeButton.disabled = isLoading;
        const buttonText = this.scrapeButton.querySelector('span');
        const buttonIcon = this.scrapeButton.querySelector('i');
        
        if (isLoading) {
            buttonText.textContent = 'Scraping...';
            buttonIcon.className = 'fas fa-spinner fa-spin';
            this.scrapeButton.classList.add('loading');
        } else {
            buttonText.textContent = 'Start Scraping';
            buttonIcon.className = 'fas fa-play';
            this.scrapeButton.classList.remove('loading');
        }
    }

    /**
     * Show the progress section
     */
    showProgress() {
        this.progressSection.style.display = 'block';
    }

    /**
     * Hide the progress section
     */
    hideProgress() {
        this.progressSection.style.display = 'none';
    }

    /**
     * Update progress bar and text
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} text - Progress text to display
     */
    updateProgress(percentage, text) {
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = text;
    }

    /**
     * Clear previous results
     */
    clearResults() {
        this.resultsContent.textContent = '';
        this.resultsSection.style.display = 'none';
    }

    /**
     * Clear previous logs
     */
    clearLogs() {
        this.logsContent.textContent = '';
        this.logsSection.style.display = 'none';
    }

    /**
     * Display scraping results
     * @param {Object} results - Results from the scraper
     */
    displayResults(results) {
        this.resultsSection.style.display = 'block';
        
        let output = '';
        
        if (results.success) {
            output += this.formatSuccessResults(results);
        } else {
            output += this.formatErrorResults(results);
        }
        
        this.resultsContent.textContent = output;
        this.resultsContent.scrollTop = 0;
    }

    /**
     * Format successful scraping results
     * @param {Object} results - Successful results
     * @returns {string} Formatted output
     */
    formatSuccessResults(results) {
        let output = '';
        
        output += '='.repeat(60) + '\n';
        output += 'HACKER NEWS ARTICLE SORTING VALIDATION\n';
        output += '='.repeat(60) + '\n';
        output += `Total articles analyzed: ${results.totalArticles}\n`;
        output += `Pages navigated: ${results.pagesNavigated}\n`;
        output += `Validation: EXACTLY 100 articles sorted from newest to oldest\n\n`;
        
        if (results.isCorrectlySorted) {
            output += '✅ SUCCESS: Articles are correctly sorted from newest to oldest!\n';
        } else {
            output += '❌ FAILURE: Articles are NOT correctly sorted!\n';
            output += `Found ${results.sortingErrors.length} sorting errors:\n\n`;
            
            results.sortingErrors.slice(0, 5).forEach((error, index) => {
                output += `Error ${index + 1} at position ${error.position}:\n`;
                output += `  Current: "${error.current.title}" (${error.current.timeText})\n`;
                output += `  Next:    "${error.next.title}" (${error.next.timeText})\n\n`;
            });
            
            if (results.sortingErrors.length > 5) {
                output += `... and ${results.sortingErrors.length - 5} more errors\n\n`;
            }
        }
        
        output += `\nAll ${results.totalArticles} articles (newest to oldest):\n`;
        output += '='.repeat(100) + '\n';
        
        results.articles.forEach((article, index) => {
            output += `${String(index + 1).padStart(3, ' ')}. [Page ${article.page}] ${article.title} (${article.timeText})\n`;
        });
        
        output += '\nArticle Distribution by Page:\n';
        output += '-'.repeat(40) + '\n';
        
        const pageCounts = {};
        results.articles.forEach(article => {
            pageCounts[article.page] = (pageCounts[article.page] || 0) + 1;
        });
        
        Object.keys(pageCounts).sort().forEach(page => {
            output += `Page ${page}: ${pageCounts[page]} articles\n`;
        });
        
        output += '\n' + '='.repeat(60) + '\n';
        
        return output;
    }

    /**
     * Format error results
     * @param {Object} results - Error results
     * @returns {string} Formatted error output
     */
    formatErrorResults(results) {
        let output = '';
        
        output += '='.repeat(60) + '\n';
        output += 'SCRAPING ERROR\n';
        output += '='.repeat(60) + '\n';
        output += `Error: ${results.error}\n`;
        output += `Time: ${new Date().toLocaleString()}\n`;
        output += '='.repeat(60) + '\n';
        
        return output;
    }

    /**
     * Display error message
     * @param {string} message - Error message to display
     */
    displayError(message) {
        this.resultsSection.style.display = 'block';
        this.resultsContent.textContent = `Error: ${message}`;
    }

    /**
     * Utility function to create delays
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after the delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch and render ranked articles from the API
     */
    async loadRankedArticles() {
        if (!this.rankedArticlesList) {
            return;
        }

        try {
            this.setRankedLoading(true);
            this.showRankedError('');

            const response = await fetch('/api/articles/ranked');

            if (!response.ok) {
                throw new Error(`Unable to load ranked articles (status ${response.status})`);
            }

            const payload = await response.json();
            const articles = this.normalizeRankedArticles(payload);

            if (!articles.length) {
                throw new Error('No ranked articles are available right now.');
            }

            this.renderRankedArticles(articles);
        } catch (error) {
            console.error('Failed to load ranked articles:', error);
            this.renderRankedArticles([]);
            this.showRankedError(error.message || 'Failed to load ranked articles.');
        } finally {
            this.setRankedLoading(false);
        }
    }

    /**
     * Normalize ranked article payloads from the API
     * @param {any} payload - Response payload
     * @returns {Array<Object>} Normalized articles
     */
    normalizeRankedArticles(payload) {
        if (!payload) {
            return [];
        }

        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload.articles)) {
            return payload.articles;
        }

        if (Array.isArray(payload.data)) {
            return payload.data;
        }

        return [];
    }

    /**
     * Display or hide the ranked articles loading indicator
     * @param {boolean} isLoading - Whether ranked articles are loading
     */
    setRankedLoading(isLoading) {
        if (!this.rankedArticlesLoading) {
            return;
        }

        this.rankedArticlesLoading.style.display = isLoading ? 'flex' : 'none';
    }

    /**
     * Show an error message for the ranked articles section
     * @param {string} message - Error message to display
     */
    showRankedError(message) {
        if (!this.rankedArticlesError) {
            return;
        }

        if (message) {
            this.rankedArticlesError.textContent = message;
            this.rankedArticlesError.hidden = false;
        } else {
            this.rankedArticlesError.textContent = '';
            this.rankedArticlesError.hidden = true;
        }
    }

    /**
     * Render the ranked articles list
     * @param {Array<Object>} articles - Ranked articles
     */
    renderRankedArticles(articles) {
        if (!this.rankedArticlesList) {
            return;
        }

        this.rankedArticlesList.innerHTML = '';

        if (!articles.length) {
            return;
        }

        articles.forEach((article, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'ranked-article-item';

            const rank = document.createElement('div');
            rank.className = 'ranked-article-rank';

            const rankNumber = document.createElement('span');
            rankNumber.className = 'rank-number';
            rankNumber.textContent = `${index + 1}`;

            const rankIcon = document.createElement('i');
            rankIcon.className = 'fas fa-arrow-down-wide-short';
            rankIcon.setAttribute('aria-hidden', 'true');

            rank.append(rankNumber, rankIcon);

            const titleLink = document.createElement('a');
            titleLink.className = 'ranked-article-title';
            titleLink.textContent = article.title || `Article ${index + 1}`;
            if (article.url) {
                titleLink.href = article.url;
                titleLink.target = '_blank';
                titleLink.rel = 'noopener noreferrer';
            } else {
                titleLink.href = '#';
            }

            const scoreBadge = document.createElement('span');
            scoreBadge.className = 'score-badge';
            const scoreValue = this.resolveArticleScore(article);
            scoreBadge.setAttribute('aria-label', `Article score ${scoreValue}`);

            const scoreIcon = document.createElement('i');
            scoreIcon.className = 'fas fa-star';
            scoreIcon.setAttribute('aria-hidden', 'true');

            const scoreText = document.createElement('span');
            scoreText.className = 'score-value';
            scoreText.textContent = `${scoreValue}`;

            scoreBadge.append(scoreIcon, scoreText);

            listItem.append(rank, titleLink, scoreBadge);
            this.rankedArticlesList.appendChild(listItem);
        });
    }

    /**
     * Resolve the score value from an article object
     * @param {Object} article - Article entry
     * @returns {string|number}
     */
    resolveArticleScore(article) {
        const score = article?.score ?? article?.points ?? article?.value;
        if (score === undefined || score === null || score === '') {
            return 'N/A';
        }
        return score;
    }
}

// Initialize the scraper when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HackerNewsScraper();
});
