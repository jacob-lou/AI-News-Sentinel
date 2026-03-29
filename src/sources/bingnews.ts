import * as cheerio from 'cheerio'
import { TrendSource, TrendData } from './base'

// 多组 AI/科技相关搜索词，覆盖国际和国内 AI 热点
const NEWS_QUERIES = [
  'AI artificial intelligence LLM',
  'OpenAI GPT Anthropic Claude',
  'DeepSeek AI',
  'Qwen Alibaba AI',
  'AI startup funding',
  'machine learning breakthrough',
]

export class BingNewsSource implements TrendSource {
  name = 'bingnews'

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []
    const seen = new Set<string>()

    // 每次随机选3个查询，避免请求过多
    const shuffled = NEWS_QUERIES.sort(() => Math.random() - 0.5)
    const selectedQueries = shuffled.slice(0, 3)

    for (const query of selectedQueries) {
      try {
        const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })

        if (!response.ok) continue

        const xml = await response.text()
        const $ = cheerio.load(xml, { xml: true })

        $('item').each((_, el) => {
          const title = $(el).find('title').text().trim()
          if (!title) return

          const link = $(el).find('link').text().trim()
          const pubDate = $(el).find('pubDate').text().trim()
          const description = $(el).find('description').text().trim()
          const source = $(el).find('News\\:Source, source').text().trim()

          // 去重：基于标题相似度
          const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
          if (seen.has(normalizedTitle)) return
          seen.add(normalizedTitle)

          items.push({
            title,
            url: link || undefined,
            source: this.name,
            score: 0, // Bing News 没有公开的热度分数
            externalId: `bing-${normalizedTitle.substring(0, 80)}`,
            publishedAt: pubDate ? new Date(pubDate) : undefined,
            extra: JSON.stringify({
              query,
              newsSource: source,
              description: description.substring(0, 300),
            }),
          })
        })

        await new Promise((r) => setTimeout(r, 500))
      } catch {
        // 单个查询失败不影响其他
      }
    }

    return items
  }
}
