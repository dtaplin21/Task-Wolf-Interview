// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

/**
 * Configuration constants for the web scraper
 */
const CONFIG = {
  TARGET_URL: process.argv[2] || "https://news.ycombinator.com/newest", // Use command line argument or default
  REQUIRED_ARTICLE_COUNT: 100,
  MAX_PAGES_TO_SCRAPE: 4,
  PAGE_LOAD_TIMEOUT: 15000,
  ARTICLE_SELECTOR_TIMEOUT: 10000,
  BROWSER_ARGS: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
};

/**
 * Time conversion mapping for parsing relative time strings
 */
const TIME_UNIT_TO_MILLISECONDS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Launches a Chromium browser with stable settings for web scraping
 * @returns {Promise<import('playwright').Browser>} The launched browser instance
 */
async function launchStableBrowser() {
  try {
    console.log("Launching Chromium browser with stable settings...");
    const browser = await chromium.launch({ 
      headless: true,
      args: CONFIG.BROWSER_ARGS
    });
    return browser;
  } catch (error) {
    console.error("Failed to launch browser:", error.message);
    throw new Error(`Browser launch failed: ${error.message}`);
  }
}

/**
 * Navigates to the target page and waits for content to load
 * @param {import('playwright').Page} page - The Playwright page instance
 * @returns {Promise<void>}
 */
async function navigateToTargetPage(page) {
  try {
    console.log(`Navigating to ${CONFIG.TARGET_URL}...`);
    await page.goto(CONFIG.TARGET_URL, { waitUntil: 'networkidle' });
    
    console.log("Waiting for page content to load...");
    await page.waitForSelector('.athing', { timeout: CONFIG.PAGE_LOAD_TIMEOUT });
    console.log(`✅ Successfully loaded ${new URL(CONFIG.TARGET_URL).hostname}`);
  } catch (error) {
    console.error(`Failed to navigate to ${CONFIG.TARGET_URL}:`, error.message);
    throw new Error(`Navigation failed: ${error.message}`);
  }
}

/**
 * Extracts article data from the current page using browser evaluation
 * @param {import('playwright').Page} page - The Playwright page instance
 * @param {number} startPosition - The starting position for article numbering
 * @param {number} pageNumber - The current page number
 * @returns {Promise<Array>} Array of article objects with metadata
 */
async function extractArticlesFromCurrentPage(page, startPosition, pageNumber) {
  try {
    console.log(`Extracting articles from page ${pageNumber}...`);
    
    const articlesOnPage = await page.evaluate(({ startPosition, pageNumber }) => {
      const articleElements = document.querySelectorAll('.athing');
      const extractedArticles = [];
      
      for (let i = 0; i < articleElements.length; i++) {
        const articleElement = articleElements[i];
        const articleId = articleElement.id;
        
        // Find the corresponding subtext element for timestamp information
        const articleContainer = document.getElementById(articleId);
        const subtextElement = articleContainer ? 
          articleContainer.nextElementSibling?.querySelector('.subtext') : null;
        
        if (subtextElement) {
          const timeElement = subtextElement.querySelector('.age a');
          if (timeElement) {
            const relativeTimeText = timeElement.textContent.trim();
            const isoTimeString = timeElement.getAttribute('title');
            const titleElement = articleElement.querySelector('.titleline a');
            const articleTitle = titleElement ? titleElement.textContent.trim() : 'No title';
            
            extractedArticles.push({
              id: articleId,
              title: articleTitle,
              timeText: relativeTimeText,
              timeISO: isoTimeString,
              position: startPosition + i + 1,
              page: pageNumber
            });
          }
        }
      }
      
      return extractedArticles;
    }, { startPosition, pageNumber });
    
    console.log(`✅ Found ${articlesOnPage.length} articles on page ${pageNumber}`);
    return articlesOnPage;
  } catch (error) {
    console.error(`Failed to extract articles from page ${pageNumber}:`, error.message);
    throw new Error(`Article extraction failed: ${error.message}`);
  }
}

/**
 * Attempts to navigate to the next page of articles
 * @param {import('playwright').Page} page - The Playwright page instance
 * @returns {Promise<boolean>} True if navigation was successful, false otherwise
 */
async function navigateToNextPage(page) {
  try {
    const moreButton = await page.$('a.morelink');
    
    if (!moreButton) {
      console.log("No 'More' button found. Reached end of pages.");
      return false;
    }
    
    // Get the href attribute to construct the full URL
    const moreButtonHref = await moreButton.getAttribute('href');
    if (!moreButtonHref) {
      console.log("Could not get href from more button");
      return false;
    }
    
    // Construct the full URL for the next page
    const nextPageUrl = moreButtonHref.startsWith('http') ? 
      moreButtonHref : `https://news.ycombinator.com/${moreButtonHref}`;
    
    console.log(`Navigating to next page: ${nextPageUrl}`);
    await page.goto(nextPageUrl, { waitUntil: 'networkidle' });
    
    // Wait for articles to load on the new page
    await page.waitForSelector('.athing', { timeout: CONFIG.ARTICLE_SELECTOR_TIMEOUT });
    
    console.log("✅ Successfully navigated to next page");
    return true;
  } catch (error) {
    console.log(`Error navigating to next page: ${error.message}`);
    console.log("Continuing with available articles...");
    return false;
  }
}

/**
 * Collects articles from multiple pages until we have enough for validation
 * @param {import('playwright').Page} page - The Playwright page instance
 * @returns {Promise<Array>} Array of collected articles
 */
async function collectArticlesFromMultiplePages(page) {
  let allCollectedArticles = [];
  let currentPageNumber = 1;
  
  console.log("Collecting articles from multiple pages to get 100 articles...");
  
  while (allCollectedArticles.length < CONFIG.REQUIRED_ARTICLE_COUNT && 
         currentPageNumber <= CONFIG.MAX_PAGES_TO_SCRAPE) {
    
    console.log(`\n--- Page ${currentPageNumber} ---`);
    
    try {
      // Wait for articles to load on current page
      await page.waitForSelector('.athing', { timeout: CONFIG.ARTICLE_SELECTOR_TIMEOUT });
      
      // Extract articles from current page
      const articlesFromCurrentPage = await extractArticlesFromCurrentPage(
        page, 
        allCollectedArticles.length, 
        currentPageNumber
      );
      
      allCollectedArticles = allCollectedArticles.concat(articlesFromCurrentPage);
      
      // Check if we have enough articles
      if (allCollectedArticles.length >= CONFIG.REQUIRED_ARTICLE_COUNT) {
        console.log(`✅ Collected enough articles (${allCollectedArticles.length})`);
        break;
      }
      
      // Try to navigate to next page
      const navigationSuccessful = await navigateToNextPage(page);
      if (!navigationSuccessful) {
        console.log("Cannot navigate to more pages. Stopping collection.");
        break;
      }
      
      currentPageNumber++;
    } catch (error) {
      console.error(`Error processing page ${currentPageNumber}:`, error.message);
      break;
    }
  }
  
  return allCollectedArticles;
}

/**
 * Parses timestamp information from article data
 * @param {Object} article - Article object with time information
 * @param {number} referenceTimestamp - Current timestamp for relative time calculations
 * @returns {Object} Article object with parsed timestamp
 */
function parseArticleTimestamp(article, referenceTimestamp) {
  let parsedTimestamp;
  
  // First, try to parse ISO timestamp if available
  if (article.timeISO) {
    const isoParsedDate = new Date(article.timeISO);
    if (!Number.isNaN(isoParsedDate.getTime())) {
      parsedTimestamp = isoParsedDate;
    }
  }
  
  // If ISO parsing failed, try to parse relative time strings
  if (!parsedTimestamp && article.timeText) {
    const relativeTimeText = article.timeText.toLowerCase();
    const timePatternMatch = relativeTimeText.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    
    if (timePatternMatch) {
      const timeValue = parseInt(timePatternMatch[1], 10);
      const timeUnit = timePatternMatch[2];
      const unitMilliseconds = TIME_UNIT_TO_MILLISECONDS[timeUnit];
      
      if (unitMilliseconds) {
        parsedTimestamp = new Date(referenceTimestamp - timeValue * unitMilliseconds);
      }
    }
  }
  
  // If all parsing attempts failed, assume it's very recent
  if (!parsedTimestamp) {
    parsedTimestamp = new Date(referenceTimestamp);
  }
  
  return {
    ...article,
    timestamp: parsedTimestamp
  };
}

/**
 * Validates that articles are sorted from newest to oldest
 * @param {Array} articlesWithTimestamps - Array of articles with parsed timestamps
 * @returns {Object} Validation result with sorting status and errors
 */
function validateArticleSorting(articlesWithTimestamps) {
  const sortingValidationResult = {
    isCorrectlySorted: true,
    sortingErrors: []
  };
  
  for (let i = 0; i < articlesWithTimestamps.length - 1; i++) {
    const currentArticle = articlesWithTimestamps[i];
    const nextArticle = articlesWithTimestamps[i + 1];
    
    // Check if current article is older than the next one (incorrect order)
    if (currentArticle.timestamp < nextArticle.timestamp) {
      sortingValidationResult.isCorrectlySorted = false;
      sortingValidationResult.sortingErrors.push({
        position: i + 1,
        current: {
          title: currentArticle.title,
          timeText: currentArticle.timeText,
          timestamp: currentArticle.timestamp
        },
        next: {
          title: nextArticle.title,
          timeText: nextArticle.timeText,
          timestamp: nextArticle.timestamp
        }
      });
    }
  }
  
  return sortingValidationResult;
}

/**
 * Displays the validation results and article information
 * @param {Array} articlesWithTimestamps - Array of articles with parsed timestamps
 * @param {Object} validationResult - Result from validateArticleSorting
 * @param {number} pagesNavigated - Number of pages that were processed
 */
function displayValidationResults(articlesWithTimestamps, validationResult, pagesNavigated) {
  console.log("\n" + "=".repeat(60));
  console.log("HACKER NEWS ARTICLE SORTING VALIDATION");
  console.log("=".repeat(60));
  console.log(`Total articles analyzed: ${articlesWithTimestamps.length}`);
  console.log(`Pages navigated: ${pagesNavigated}`);
  console.log(`Validation: EXACTLY ${CONFIG.REQUIRED_ARTICLE_COUNT} articles sorted from newest to oldest`);
  
  if (validationResult.isCorrectlySorted) {
    console.log("✅ SUCCESS: Articles are correctly sorted from newest to oldest!");
  } else {
    console.log("❌ FAILURE: Articles are NOT correctly sorted!");
    console.log(`Found ${validationResult.sortingErrors.length} sorting errors:`);
    
    // Display first 5 errors
    validationResult.sortingErrors.slice(0, 5).forEach((error, index) => {
      console.log(`\nError ${index + 1} at position ${error.position}:`);
      console.log(`  Current: "${error.current.title}" (${error.current.timeText})`);
      console.log(`  Next:    "${error.next.title}" (${error.next.timeText})`);
    });
    
    if (validationResult.sortingErrors.length > 5) {
      console.log(`\n... and ${validationResult.sortingErrors.length - 5} more errors`);
    }
  }
  
  // Display all articles for verification
  console.log(`\nAll ${articlesWithTimestamps.length} articles (newest to oldest):`);
  console.log("=".repeat(100));
  articlesWithTimestamps.forEach((article, index) => {
    console.log(`${String(index + 1).padStart(3, ' ')}. [Page ${article.page}] ${article.title} (${article.timeText})`);
  });
  
  // Display summary statistics by page
  console.log("\nArticle Distribution by Page:");
  console.log("-".repeat(40));
  const articlesPerPage = {};
  articlesWithTimestamps.forEach(article => {
    articlesPerPage[article.page] = (articlesPerPage[article.page] || 0) + 1;
  });
  Object.keys(articlesPerPage).sort().forEach(page => {
    console.log(`Page ${page}: ${articlesPerPage[page]} articles`);
  });
  
  console.log("\n" + "=".repeat(60));
}

/**
 * Main function that orchestrates the Hacker News article sorting validation
 */
async function validateHackerNewsArticleSorting() {
  let browser;
  
  try {
    // Launch browser and create page
    browser = await launchStableBrowser();
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    
    // Navigate to target page
    await navigateToTargetPage(page);
    
    // Collect articles from multiple pages
    const allCollectedArticles = await collectArticlesFromMultiplePages(page);
    
    // Take exactly the required number of articles
    const articlesForValidation = allCollectedArticles.slice(0, CONFIG.REQUIRED_ARTICLE_COUNT);
    
    console.log(`\nTotal articles collected: ${allCollectedArticles.length}`);
    console.log(`Using first ${CONFIG.REQUIRED_ARTICLE_COUNT} articles for validation`);
    
    // Validate we have enough articles
    if (articlesForValidation.length < CONFIG.REQUIRED_ARTICLE_COUNT) {
      console.warn(`Warning: Only found ${articlesForValidation.length} articles, expected ${CONFIG.REQUIRED_ARTICLE_COUNT}`);
      console.warn(`This may be due to pagination limitations or page loading issues.`);
      console.warn(`Proceeding with validation of available articles...`);
    } else {
      console.log(`✅ Successfully collected exactly ${CONFIG.REQUIRED_ARTICLE_COUNT} articles!`);
    }
    
    // Check for critical failure
    if (articlesForValidation.length < 10) {
      throw new Error(`Insufficient articles found: ${articlesForValidation.length}. This may indicate a page loading issue.`);
    }
    
    // Parse timestamps and validate sorting
    console.log("Validating article sorting...");
    const currentTimestamp = Date.now();
    const articlesWithParsedTimestamps = articlesForValidation.map(article => 
      parseArticleTimestamp(article, currentTimestamp)
    );
    
    // Validate sorting order
    const sortingValidationResult = validateArticleSorting(articlesWithParsedTimestamps);
    
    // Display results
    displayValidationResults(articlesWithParsedTimestamps, sortingValidationResult, 
      Math.ceil(allCollectedArticles.length / 30)); // Estimate pages based on typical 30 articles per page
    
    // Add a small delay to ensure all output is displayed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error("Error during validation:", error.message);
    throw error;
  } finally {
    // Ensure browser is always closed
    if (browser) {
      try {
        await browser.close();
        console.log("✅ Browser closed successfully");
      } catch (closeError) {
        console.error("Error closing browser:", closeError.message);
      }
    }
  }
}

// Execute the main validation function
(async () => {
  try {
    await validateHackerNewsArticleSorting();
  } catch (error) {
    console.error("Script execution failed:", error.message);
    process.exit(1);
  }
})();
