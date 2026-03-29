import { TrendSource, TrendData } from './base'

interface HNAlgoliaHit {
  objectID: string
  title: string
  url?: string
  points: number
  num_comments: number
  author: string
  created_at_i: number  // unix timestamp
}

interface HNAlgoliaResponse {
  hits: HNAlgoliaHit[]
}

// 质量过滤阈值
const MIN_SCORE = 20
const MIN_COMMENTS = 3
// 最多回溯30天
const MAX_AGE_DAYS = 30

export class HackerNewsSource implements TrendSource {
  name = 'hackernews'

  async fetch(): Promise<TrendData[]> {
    // 使用 Algolia API 搜索前端页面文章，支持按时间过滤
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400

    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40&numericFilters=created_at_i>${cutoffTimestamp},points>=${MIN_SCORE},num_comments>=${MIN_COMMENTS}`
    )
    if (!response.ok) {
      throw new Error(`HackerNews Algolia API failed: ${response.status}`)
    }

    const data = await response.json() as HNAlgoliaResponse
    const items: TrendData[] = []

    for (const hit of data.hits) {
      if (!hit.title) continue
      items.push({
        title: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: this.name,
        score: hit.points || 0,
        externalId: `hn-${hit.objectID}`,
        publishedAt: new Date(hit.created_at_i * 1000),
        extra: JSON.stringify({
          comments: hit.num_comments || 0,
          author: hit.author,
        }),
      })
    }

    return items
  }
}
