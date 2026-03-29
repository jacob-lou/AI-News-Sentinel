import * as cheerio from 'cheerio'
import { TrendSource, TrendData } from './base'

export class GoogleTrendsSource implements TrendSource {
  name = 'google'

  async fetch(): Promise<TrendData[]> {
    const url = 'https://trends.google.com/trending/rss?geo=US'
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Google Trends RSS failed: ${response.status}`)
    }

    const xml = await response.text()
    const $ = cheerio.load(xml, { xml: true })
    const items: TrendData[] = []

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim()
      const link = $(el).find('link').text().trim()
      const traffic = $(el).find('ht\\:approx_traffic, approx_traffic').text().trim()
      const pubDate = $(el).find('pubDate').text().trim()
      const score = parseInt(traffic.replace(/[^0-9]/g, '')) || 0

      if (title) {
        items.push({
          title,
          url: link || undefined,
          source: this.name,
          score,
          externalId: `google-${title.toLowerCase().replace(/\s+/g, '-')}`,
          publishedAt: pubDate ? new Date(pubDate) : undefined,
          extra: JSON.stringify({ traffic }),
        })
      }
    })

    return items
  }
}
