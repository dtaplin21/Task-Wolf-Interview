'use strict';

let storedArticles = [];
let storedMetadata = null;

function cloneArticles(articles) {
    return articles.map(article => ({ ...article }));
}

function cloneMetadata(metadata) {
    if (metadata === null || metadata === undefined) {
        return null;
    }
    return { ...metadata };
}

function validateArticlesInput(articles) {
    if (!Array.isArray(articles)) {
        throw new TypeError('Articles must be provided as an array.');
    }
}

function saveArticles({ articles, metadata = null }) {
    validateArticlesInput(articles);
    storedArticles = cloneArticles(articles);
    storedMetadata = cloneMetadata(metadata);
}

function getAllArticles() {
    return {
        articles: cloneArticles(storedArticles),
        metadata: cloneMetadata(storedMetadata)
    };
}

function clearArticles() {
    storedArticles = [];
    storedMetadata = null;
}

module.exports = {
    saveArticles,
    getAllArticles,
    clearArticles
};
