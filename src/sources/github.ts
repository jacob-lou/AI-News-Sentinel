import * as cheerio from 'cheerio'
import { TrendSource, TrendData } from './base'

export class GitHubTrendingSource implements TrendSource {
  name = 'github'

  async fetch(): Promise<TrendData[]> {
    const response = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub Trending failed: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const items: TrendData[] = []

    $('article.Box-row').each((_, el) => {
      const repoPath = $(el).find('h2 a').text().trim().replace(/\s+/g, '')
      if (!repoPath) return

      const desc = $(el).find('p').text().trim()
      const lang = $(el).find('[itemprop="programmingLanguage"]').text().trim()
      const starsText = $(el).find('a[href$="/stargazers"]').text().trim()
      const stars = parseInt(starsText.replace(/,/g, '')) || 0

      // 提取今日新增星标
      const todayText = $(el).find('.float-sm-right, .d-inline-block.float-sm-right').last().text().trim()
      const todayStars = parseInt(todayText.replace(/[^0-9]/g, '')) || 0

      items.push({
        title: `${repoPath}${desc ? ' — ' + desc.substring(0, 120) : ''}`,
        url: `https://github.com/${repoPath}`,
        source: this.name,
        score: todayStars || stars,
        externalId: `gh-${repoPath.toLowerCase()}`,
        extra: JSON.stringify({
          repo: repoPath,
          description: desc.substring(0, 300),
          language: lang,
          stars,
          todayStars,
        }),
      })
    })

    return items
  }
}
