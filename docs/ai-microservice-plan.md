# API Surface and AI Microservice Plan

## Existing Server Routes
The current `server.js` exposes the following routes:

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `GET` | `/` | Serves the frontend `index.html` page. |
| `POST` | `/api/scrape` | Accepts a JSON body with a `url` to run the Hacker News scraper, returning the parsed results and raw output. |
| `GET` | `/api/health` | Provides health check metadata for the scraper service. |

## Planned AI Microservice Responsibilities
The AI microservice will complement the scraper by handling intelligent analysis and caching of article metadata. Its responsibilities include:

1. **Article Fetching Support**
   - Receive requests to obtain article metadata produced by the scraper service.
   - Normalize the data structure (title, URL, time metadata, ranking position, page number).
   - Provide hooks to fetch additional article context when requested (e.g., follow-up summaries via external APIs).

2. **Scoring and Ranking**
   - Generate AI-driven relevance or quality scores for each article.
   - Support customizable scoring criteria such as topical alignment, freshness, and engagement signals.
   - Return ranked lists while preserving original scraper metadata for traceability.

3. **Caching Layer**
   - Cache scraper results and AI scores keyed by article URL or scraper request ID.
   - Implement cache invalidation policies (e.g., TTL-based expiry, manual purge endpoints).
   - Offer cache hit/miss metrics for observability.

## Interface Specifications for AI Scoring
To coordinate between the existing scraper and the new AI microservice, the following interfaces are proposed:

### Internal Module Contracts
```ts
interface ArticleInput {
  id: string;           // Stable identifier (URL hash or scraper request ID)
  url: string;
  title: string;
  page: number;
  position: number;
  timeText: string;     // Original time text (e.g., "3 hours ago")
  fetchedAt: string;    // ISO timestamp of scraper run
}

interface ScoreCriteria {
  focusTopics?: string[];
  freshnessWeight?: number; // 0-1 weighting for recency
  engagementWeight?: number; // 0-1 weighting for HN score/points
}

interface ArticleScore {
  articleId: string;
  score: number;        // Normalized 0-1 score
  explanations: string[];
  computedAt: string;   // ISO timestamp
}

function scoreArticles(
  articles: ArticleInput[],
  criteria?: ScoreCriteria
): Promise<ArticleScore[]>;

function getCachedScores(articleIds: string[]): Promise<ArticleScore[]>;

function cacheScores(scores: ArticleScore[], ttlSeconds?: number): Promise<void>;
```

### REST Endpoints
All routes are prefixed with `/api/ai` to distinguish the microservice.

| Method | Route | Description | Request Body | Response |
| ------ | ----- | ----------- | ------------ | -------- |
| `POST` | `/api/ai/score` | Trigger AI scoring for supplied articles. | `{ articles: ArticleInput[], criteria?: ScoreCriteria }` | `{ scores: ArticleScore[], cacheKey: string }` |
| `GET` | `/api/ai/score` | Retrieve cached scores using `articleIds` or a `cacheKey` query. | Query: `articleIds=...` or `cacheKey=...` | `{ scores: ArticleScore[], cacheStatus: 'hit' | 'miss' }` |
| `DELETE` | `/api/ai/cache` | Invalidate cached scores. | `{ articleIds?: string[], cacheKey?: string }` | `{ success: boolean, invalidated: string[] }` |

### Event/Webhook Considerations
- Optional webhook `POST /api/ai/events/score-completed` for async score completion notifications.
- Event payload mirrors `{ cacheKey, scores }` to notify upstream services.

These interfaces keep the AI microservice modular, while enabling tight integration with the existing scraper workflow exposed in `server.js`.
