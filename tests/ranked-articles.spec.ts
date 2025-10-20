import { test, expect } from '@playwright/test';

const mockArticles = [
  { title: 'Cutting Edge AI Research', url: 'https://example.com/ai', score: 314 },
  { title: 'Scaling Systems in Production', url: 'https://example.com/scaling', score: 211 },
  { title: 'Refactoring Legacy Applications', url: 'https://example.com/refactor', score: 158 }
];

test.describe('Ranked articles section', () => {
  test('renders ranked results with score indicators', async ({ page }) => {
    await page.route('**/api/articles/ranked', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: mockArticles })
      });
    });

    await page.goto('/');

    const loadingIndicator = page.locator('#rankedArticlesLoading');
    await expect(loadingIndicator).toBeHidden();

    const rankedItems = page.locator('.ranked-article-item');
    await expect(rankedItems).toHaveCount(mockArticles.length);

    const firstItem = rankedItems.first();
    await expect(firstItem.locator('.rank-number')).toHaveText('1');
    await expect(firstItem.locator('.ranked-article-title')).toHaveText(mockArticles[0].title);
    await expect(firstItem.locator('.score-badge')).toContainText(String(mockArticles[0].score));

    const scoreTexts = await rankedItems.locator('.score-value').allTextContents();
    expect(scoreTexts).toEqual(mockArticles.map(article => String(article.score)));

    await expect(page.locator('.ranked-articles__sort')).toBeVisible();
  });
});
