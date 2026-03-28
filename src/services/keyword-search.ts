export interface KeywordSearchResult {
  title: string
  url?: string
  source: string
  score: number
  snippet?: string
  extra?: string
}

export class KeywordSearchService {
  private twitterApiKey: string | null = null

  constructor() {
    const key = process.env.TWITTER_API_KEY
    if (key && key !== 'your_twitter_api_key_here') {
      this.twitterApiKey = key
    }
  }

  async searchAll(keyword: string): Promise<KeywordSearchResult[]> {
    const results = await Promise.allSettled([
      this.searchReddit(keyword),
      this.searchHackerNews(keyword),
      this.searchTwitter(keyword),
      this.searchDuckDuckGo(keyword),
    ])

    const items: KeywordSearchResult[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        items.push(...r.value)
      }
    }
    return items
  }

  private async searchReddit(keyword: string): Promise<KeywordSearchResult[]> {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=15&t=day`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TrendTracker/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const posts = data?.data?.children || []
    return posts.map((p: any) => ({
      title: p.data.title,
      url: `https://reddit.com${p.data.permalink}`,
      source: 'reddit',
      score: p.data.score || 0,
      snippet: (p.data.selftext || '').slice(0, 200),
      extra: JSON.stringify({ subreddit: p.data.subreddit, num_comments: p.data.num_comments }),
    }))
  }

  private async searchHackerNews(keyword: string): Promise<KeywordSearchResult[]> {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=15`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    const hits = data?.hits || []
    return hits.map((h: any) => ({
      title: h.title || '',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: 'hackernews',
      score: h.points || 0,
      snippet: (h.story_text || '').slice(0, 200),
      extra: JSON.stringify({ comments: h.num_comments, author: h.author }),
    }))
  }

  private async searchTwitter(keyword: string): Promise<KeywordSearchResult[]> {
    if (!this.twitterApiKey) return []
    try {
      const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(keyword)}&queryType=Top&count=15`
      const res = await fetch(url, {
        headers: { 'x-api-key': this.twitterApiKey },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return []
      const data = await res.json()
      const tweets = data?.tweets || []
      return tweets.map((t: any) => ({
        title: (t.text || '').slice(0, 150),
        url: t.url || undefined,
        source: 'twitter',
        score: (t.likeCount || 0) + (t.retweetCount || 0),
        snippet: (t.text || '').slice(0, 200),
        extra: JSON.stringify({ likes: t.likeCount, retweets: t.retweetCount, author: t.author?.userName }),
      }))
    } catch {
      return []
    }
  }

  private async searchDuckDuckGo(keyword: string): Promise<KeywordSearchResult[]> {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(keyword)}&format=json&no_html=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return []
      const data = await res.json()
      const results: KeywordSearchResult[] = []

      if (data.Abstract) {
        results.push({
          title: data.Heading || keyword,
          url: data.AbstractURL || undefined,
          source: 'duckduckgo',
          score: 50,
          snippet: data.Abstract.slice(0, 200),
        })
      }
      const topics = data.RelatedTopics || []
      for (const t of topics.slice(0, 5)) {
        if (t.Text) {
          results.push({
            title: t.Text.slice(0, 120),
            url: t.FirstURL || undefined,
            source: 'duckduckgo',
            score: 10,
            snippet: t.Text.slice(0, 200),
          })
        }
      }
      return results
    } catch {
      return []
    }
  }
}
