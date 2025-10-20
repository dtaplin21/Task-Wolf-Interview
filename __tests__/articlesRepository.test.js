const test = require('node:test');
const assert = require('node:assert/strict');

const {
    saveArticles,
    getAllArticles,
    clearArticles
} = require('../src/data/articles');

test('returns empty state when nothing has been saved', () => {
    clearArticles();

    const { articles, metadata } = getAllArticles();

    assert.deepEqual(articles, []);
    assert.equal(metadata, null);
});

test('saves and retrieves article data with metadata', () => {
    clearArticles();

    const articles = [
        { position: 1, title: 'Test', page: 1, timeText: '1 hour ago' },
        { position: 2, title: 'Another', page: 1, timeText: '2 hours ago' }
    ];
    const metadata = {
        totalArticles: 2,
        pagesNavigated: 1,
        isCorrectlySorted: true,
        sortingErrors: []
    };

    saveArticles({ articles, metadata });

    const stored = getAllArticles();

    assert.deepEqual(stored.articles, articles);
    assert.deepEqual(stored.metadata, metadata);
});

test('mutating returned results does not affect internal store', () => {
    clearArticles();

    const articles = [
        { position: 1, title: 'Original', page: 1, timeText: '1 hour ago' }
    ];
    const metadata = {
        totalArticles: 1,
        pagesNavigated: 1,
        isCorrectlySorted: false,
        sortingErrors: [{ position: 1 }]
    };

    saveArticles({ articles, metadata });

    const firstRead = getAllArticles();
    firstRead.articles[0].title = 'Mutated';
    firstRead.metadata.totalArticles = 99;

    const secondRead = getAllArticles();

    assert.equal(secondRead.articles[0].title, 'Original');
    assert.equal(secondRead.metadata.totalArticles, 1);
});

test('throws when attempting to save a non-array article payload', () => {
    clearArticles();

    assert.throws(() => saveArticles({ articles: null }), {
        name: 'TypeError'
    });

    assert.throws(() => saveArticles({ articles: 'invalid' }), {
        message: 'Articles must be provided as an array.'
    });
});

test('allows saving without metadata', () => {
    clearArticles();

    const articles = [{ position: 1, title: 'No Meta', page: 2, timeText: 'just now' }];

    saveArticles({ articles });

    const stored = getAllArticles();
    assert.deepEqual(stored.articles, articles);
    assert.equal(stored.metadata, null);
});
