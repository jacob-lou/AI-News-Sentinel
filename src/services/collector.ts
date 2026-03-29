import prisma from '../db'
import { TrendSource, TrendData, SourceResult } from '../sources/base'
import { GoogleTrendsSource } from '../sources/google'
import { RedditSource } from '../sources/reddit'
import { HackerNewsSource } from '../sources/hackernews'
import { DuckDuckGoSource } from '../sources/duckduckgo'
import { TwitterSource } from '../sources/twitter'
import { GitHubTrendingSource } from '../sources/github'
import { HuggingFaceSource } from '../sources/huggingface'
import { V2EXSource } from '../sources/v2ex'
import { BingNewsSource } from '../sources/bingnews'

export class CollectorService {
  private sources: TrendSource[] = []

  constructor() {
    this.sources.push(new GoogleTrendsSource())
    this.sources.push(new RedditSource())
    this.sources.push(new HackerNewsSource())
    this.sources.push(new DuckDuckGoSource())
    this.sources.push(new GitHubTrendingSource())
    this.sources.push(new HuggingFaceSource())
    this.sources.push(new V2EXSource())
    this.sources.push(new BingNewsSource())

    const twitterApiKey = process.env.TWITTER_API_KEY
    if (twitterApiKey && twitterApiKey !== 'your_twitterapi_io_key_here') {
      this.sources.push(new TwitterSource(twitterApiKey))
    } else {
      console.warn('[Collector] Twitter API key not configured, skipping Twitter source')
    }
  }

  async collectAll(): Promise<SourceResult[]> {
    const results: SourceResult[] = []

    const promises = this.sources.map(async (source) => {
      const start = Date.now()
      try {
        const items = await source.fetch()
        const duration = Date.now() - start
        const saved = await this.saveItems(items)

        await prisma.fetchLog.create({
          data: {
            source: source.name,
            status: 'success',
            count: saved.length,
            duration,
          },
        })

        return { source: source.name, items: saved } as SourceResult
      } catch (err: any) {
        const duration = Date.now() - start
        const errorMsg = err?.message || String(err)
        console.error(`[Collector] ${source.name} failed:`, errorMsg)

        await prisma.fetchLog.create({
          data: {
            source: source.name,
            status: 'error',
            message: errorMsg.substring(0, 500),
            count: 0,
            duration,
          },
        })

        return { source: source.name, items: [], error: errorMsg } as SourceResult
      }
    })

    const settled = await Promise.allSettled(promises)
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    }

    return results
  }

  private async saveItems(items: TrendData[]): Promise<TrendData[]> {
    const saved: TrendData[] = []

    for (const item of items) {
      try {
        await prisma.trendItem.upsert({
          where: {
            source_externalId: {
              source: item.source,
              externalId: item.externalId,
            },
          },
          update: {
            score: item.score,
            extra: item.extra,
            fetchedAt: new Date(),
            publishedAt: item.publishedAt,
          },
          create: {
            title: item.title,
            url: item.url,
            source: item.source,
            score: item.score,
            extra: item.extra,
            externalId: item.externalId,
            publishedAt: item.publishedAt,
          },
        })
        saved.push(item)
      } catch (err: any) {
        console.error(`[Collector] Failed to save item "${item.title}":`, err?.message)
      }
    }

    return saved
  }
}
