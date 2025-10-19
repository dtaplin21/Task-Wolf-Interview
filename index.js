// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // launch browser with more stable settings
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // go to Hacker News
    console.log("Navigating to Hacker News newest page...");
    await page.goto("https://news.ycombinator.com/newest", { waitUntil: 'networkidle' });
    
    // Wait for the page to load and articles to be visible
    console.log("Waiting for articles to load...");
    await page.waitForSelector('.athing', { timeout: 15000 });
    
    console.log("Collecting articles from multiple pages to get 100 articles...");
    
    let allArticles = [];
    let currentPage = 1;
    const maxPages = 4; // Hacker News typically shows 30 articles per page, so 4 pages should give us 120 articles
    
    while (allArticles.length < 100 && currentPage <= maxPages) {
      console.log(`\n--- Page ${currentPage} ---`);
      
      // Wait for articles to load on current page
      await page.waitForSelector('.athing', { timeout: 10000 });
      
      // Extract articles from current page
      const pageArticles = await page.evaluate(({ startPosition, pageNumber }) => {
        const articleElements = document.querySelectorAll('.athing');
        const articles = [];
        
        for (let i = 0; i < articleElements.length; i++) {
          const article = articleElements[i];
          const id = article.id;
          
          // Find the corresponding subtext element for timestamp
          const articleElement = document.getElementById(id);
          const subtext = articleElement ? articleElement.nextElementSibling?.querySelector('.subtext') : null;
          if (subtext) {
            const timeElement = subtext.querySelector('.age a');
            if (timeElement) {
              const timeText = timeElement.textContent.trim();
              const timeISO = timeElement.getAttribute('title');
              const titleElement = article.querySelector('.titleline a');
              const title = titleElement ? titleElement.textContent.trim() : 'No title';
              
              articles.push({
                id: id,
                title: title,
                timeText: timeText,
                timeISO: timeISO,
                position: startPosition + i + 1,
                page: pageNumber
              });
            }
          }
        }
        
        return articles;
      }, { startPosition: allArticles.length, pageNumber: currentPage });
      
      console.log(`Found ${pageArticles.length} articles on page ${currentPage}`);
      allArticles = allArticles.concat(pageArticles);
      
      // If we have enough articles, break
      if (allArticles.length >= 100) {
        break;
      }
      
      // Try to navigate to next page
      try {
        const moreButton = await page.$('a.morelink');
        if (moreButton) {
          console.log(`Navigating to page ${currentPage + 1}...`);
          
          // Get the href of the more button to navigate directly
          const moreHref = await moreButton.getAttribute('href');
          if (moreHref) {
            const fullUrl = moreHref.startsWith('http') ? moreHref : `https://news.ycombinator.com/${moreHref}`;
            console.log(`Navigating to: ${fullUrl}`);
            await page.goto(fullUrl, { waitUntil: 'networkidle' });
            currentPage++;
          } else {
            console.log("Could not get href from more button");
            break;
          }
        } else {
          console.log("No 'More' button found. Reached end of pages.");
          break;
        }
      } catch (e) {
        console.log(`Error navigating to next page: ${e.message}`);
        console.log("Continuing with available articles...");
        break;
      }
    }
    
    // Take exactly 100 articles
    const articles = allArticles.slice(0, 100);
    console.log(`\nTotal articles collected: ${allArticles.length}`);
    console.log(`Using first 100 articles for validation`);
    
    console.log(`\nExtracted ${articles.length} articles for validation`);
    
    if (articles.length < 100) {
      console.warn(`Warning: Only found ${articles.length} articles, expected 100`);
      console.warn(`This may be due to pagination limitations or page loading issues.`);
      console.warn(`Proceeding with validation of available articles...`);
    } else {
      console.log(`✅ Successfully collected exactly 100 articles!`);
    }
    
    // If we have very few articles, this might indicate a problem
    if (articles.length < 10) {
      console.error(`Error: Too few articles found (${articles.length}). This may indicate a page loading issue.`);
      throw new Error(`Insufficient articles found: ${articles.length}`);
    }
    
    // Parse timestamps and validate sorting
    console.log("Validating article sorting...");
    const referenceNow = Date.now();
    const parsedArticles = articles.map(article => {
      let articleTime;
      
      if (article.timeISO) {
        const parsed = new Date(article.timeISO);
        if (!Number.isNaN(parsed.getTime())) {
          articleTime = parsed;
        }
      }
      
      // Parse relative time strings like "2 hours ago", "1 day ago", etc.
      if (!articleTime && article.timeText) {
        const timeText = article.timeText.toLowerCase();
        const timeMatch = timeText.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
        
        if (timeMatch) {
          const value = parseInt(timeMatch[1], 10);
          const unit = timeMatch[2];
          const unitToMs = {
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000,
          };
          const unitMs = unitToMs[unit];
          
          if (unitMs) {
            articleTime = new Date(referenceNow - value * unitMs);
          }
        }
      }
      
      if (!articleTime) {
        // If we can't parse the time, assume it's very recent
        articleTime = new Date(referenceNow);
      }
      
      return {
        ...article,
        timestamp: articleTime
      };
    });
    
    // Validate sorting order
    let isSorted = true;
    const sortingErrors = [];
    
    for (let i = 0; i < parsedArticles.length - 1; i++) {
      const current = parsedArticles[i];
      const next = parsedArticles[i + 1];
      
      if (current.timestamp < next.timestamp) {
        isSorted = false;
        sortingErrors.push({
          position: i + 1,
          current: {
            title: current.title,
            timeText: current.timeText,
            timestamp: current.timestamp
          },
          next: {
            title: next.title,
            timeText: next.timeText,
            timestamp: next.timestamp
          }
        });
      }
    }
    
    // Display results
    console.log("\n" + "=".repeat(60));
    console.log("HACKER NEWS ARTICLE SORTING VALIDATION");
    console.log("=".repeat(60));
    console.log(`Total articles analyzed: ${parsedArticles.length}`);
    console.log(`Pages navigated: ${currentPage}`);
    console.log(`Validation: EXACTLY 100 articles sorted from newest to oldest`);
    
    if (isSorted) {
      console.log("✅ SUCCESS: Articles are correctly sorted from newest to oldest!");
    } else {
      console.log("❌ FAILURE: Articles are NOT correctly sorted!");
      console.log(`Found ${sortingErrors.length} sorting errors:`);
      
      sortingErrors.slice(0, 5).forEach((error, index) => {
        console.log(`\nError ${index + 1} at position ${error.position}:`);
        console.log(`  Current: "${error.current.title}" (${error.current.timeText})`);
        console.log(`  Next:    "${error.next.title}" (${error.next.timeText})`);
      });
      
      if (sortingErrors.length > 5) {
        console.log(`\n... and ${sortingErrors.length - 5} more errors`);
      }
    }
    
    // Display ALL 100 articles for verification
    console.log("\nAll 100 articles (newest to oldest):");
    console.log("=".repeat(100));
    parsedArticles.forEach((article, index) => {
      console.log(`${String(index + 1).padStart(3, ' ')}. [Page ${article.page}] ${article.title} (${article.timeText})`);
    });
    
    // Display summary statistics
    console.log("\nArticle Distribution by Page:");
    console.log("-".repeat(40));
    const pageCounts = {};
    parsedArticles.forEach(article => {
      pageCounts[article.page] = (pageCounts[article.page] || 0) + 1;
    });
    Object.keys(pageCounts).sort().forEach(page => {
      console.log(`Page ${page}: ${pageCounts[page]} articles`);
    });
    
    console.log("\n" + "=".repeat(60));
    
    // Add a small delay to ensure all output is displayed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error("Error during validation:", error);
  } finally {
    // Close browser
    await browser.close();
  }
}

(async () => {
  await sortHackerNewsArticles();
})();
