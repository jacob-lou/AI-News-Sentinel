import { TrendSource, TrendData } from './base'

// AI/科技方向的搜索关键词，每次随机选一批
const AI_TECH_KEYWORDS = [
  'AI news today',
  'AI breakthrough 2026',
  'LLM latest',
  'GPT new release',
  'AI startup funding',
  'generative AI update',
  'AI agent framework',
  'open source AI model',
  'DeepSeek latest',
  'Qwen model update',
  'Claude AI update',
  'AI coding assistant',
]

// Wikipedia 等低价值 URL 过滤
const BLOCKED_DOMAINS = ['wikipedia.org', 'wiktionary.org', 'britannica.com', 'dictionary.com']

export class DuckDuckGoSource implements TrendSource {
  name = 'duckduckgo'

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []
    const seen = new Set<string>()

    // 每次随机选6个关键词，减少请求量
    const shuffled = [...AI_TECH_KEYWORDS].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 6)

    for (const keyword of selected) {
      try {
        const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })

        if (!response.ok) continue

        const data = await response.json() as any
        const suggestions: string[] = Array.isArray(data) && data.length > 1 ? data[1] : []

        for (const suggestion of suggestions) {
          const normalized = suggestion.toLowerCase().trim()
          if (seen.has(normalized) || !normalized) continue
          if (normalized === keyword.toLowerCase()) continue
          seen.add(normalized)

          items.push({
            title: suggestion,
            source: this.name,
            score: 0,
            externalId: `ddg-${normalized.replace(/\s+/g, '-').substring(0, 80)}`,
            extra: JSON.stringify({ keyword }),
          })
        }

        await new Promise((r) => setTimeout(r, 300))
      } catch {
        // 单个关键词失败不影响其他
      }
    }

    // 即时答案 API — 过滤掉 Wikipedia 等百科内容
    const topicQueries = ['AI latest news', 'large language model', 'DeepSeek AI']
    for (const query of topicQueries) {
      try {
        const response = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
          { headers: { 'User-Agent': 'TrendTracker/1.0' } }
        )
        if (!response.ok) continue
        const data = await response.json() as any

        if (data.Abstract && data.AbstractURL && !this.isBlockedUrl(data.AbstractURL)) {
          const title = data.Heading || query
          const normalized = title.toLowerCase().trim()
          if (!seen.has(normalized)) {
            seen.add(normalized)
            items.push({
              title,
              url: data.AbstractURL,
              source: this.name,
              score: 10,
              externalId: `ddg-abs-${normalized.replace(/\s+/g, '-').substring(0, 50)}`,
              extra: JSON.stringify({ type: 'abstract', snippet: (data.Abstract || '').substring(0, 200) }),
            })
          }
        }

        const topics = data.RelatedTopics || []
        for (const topic of topics.slice(0, 5)) {
          if (!topic.Text || !topic.FirstURL) continue
          if (this.isBlockedUrl(topic.FirstURL)) continue

          const title = topic.Text.substring(0, 100)
          const normalized = title.toLowerCase().trim()
          if (seen.has(normalized)) continue
          seen.add(normalized)

          items.push({
            title,
            url: topic.FirstURL,
            source: this.name,
            score: 5,
            externalId: `ddg-topic-${normalized.replace(/\s+/g, '-').substring(0, 50)}`,
            extra: JSON.stringify({ type: 'related_topic' }),
          })
        }
      } catch {
        // Skip errors
      }
    }

    return items
  }

  private isBlockedUrl(url: string): boolean {
    return BLOCKED_DOMAINS.some(domain => url.includes(domain))
  }
}
