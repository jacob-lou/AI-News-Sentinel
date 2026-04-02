import prisma from '../db'
import { TrendSource, TrendData, SourceResult } from '../sources/base'
import { ClassifierService } from './classifier'
import { TranslatorService } from './translator'
import { GoogleTrendsSource } from '../sources/google'
import { RedditSource } from '../sources/reddit'
import { HackerNewsSource } from '../sources/hackernews'
import { DuckDuckGoSource } from '../sources/duckduckgo'
import { TwitterSource } from '../sources/twitter'
import { GitHubTrendingSource } from '../sources/github'
import { HuggingFaceSource } from '../sources/huggingface'
import { V2EXSource } from '../sources/v2ex'
import { BingNewsSource } from '../sources/bingnews'
import { BilibiliSource } from '../sources/bilibili'

export class CollectorService {
  private sources: TrendSource[] = []
  private classifier = new ClassifierService()
  private translator = new TranslatorService()

  constructor() {
    this.sources.push(new GoogleTrendsSource())
    this.sources.push(new RedditSource())
    this.sources.push(new HackerNewsSource())
    this.sources.push(new DuckDuckGoSource())
    this.sources.push(new GitHubTrendingSource())
    this.sources.push(new HuggingFaceSource())
    this.sources.push(new V2EXSource())
    this.sources.push(new BingNewsSource())
    this.sources.push(new BilibiliSource())

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

        // Classify items before saving
        const categories = await this.classifier.classify(items)

        // Detect language and translate titles
        let translations: { language: string; titleZh: string | null; titleEn: string | null }[] = []
        try {
          translations = await this.translator.detectAndTranslate(items)
        } catch (err: any) {
          console.error(`[Collector] Translation failed for ${source.name}:`, err?.message)
          // Fill with language-only fallback
          const { detectLanguage } = require('./translator')
          translations = items.map(i => ({ language: detectLanguage(i.title), titleZh: null, titleEn: null }))
        }

        const saved = await this.saveItems(items, categories, translations)

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

  private async saveItems(
    items: TrendData[],
    categories: string[],
    translations: { language: string; titleZh: string | null; titleEn: string | null }[] = [],
  ): Promise<TrendData[]> {
    const saved: TrendData[] = []

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const category = categories[idx] || 'general'
      const tr = translations[idx] || { language: null, titleZh: null, titleEn: null }
      try {
        const commentsCount = this.extractCommentsCount(item)
        await prisma.trendItem.upsert({
          where: {
            source_externalId: {
              source: item.source,
              externalId: item.externalId,
            },
          },
          update: {
            score: item.score,
            url: item.url,
            extra: item.extra,
            fetchedAt: new Date(),
            publishedAt: item.publishedAt,
            commentsCount,
            category,
            ...(tr.language ? { language: tr.language } : {}),
            ...(tr.titleZh ? { titleZh: tr.titleZh } : {}),
            ...(tr.titleEn ? { titleEn: tr.titleEn } : {}),
          },
          create: {
            title: item.title,
            url: item.url,
            source: item.source,
            score: item.score,
            extra: item.extra,
            externalId: item.externalId,
            publishedAt: item.publishedAt,
            commentsCount,
            category,
            language: tr.language,
            titleZh: tr.titleZh,
            titleEn: tr.titleEn,
          },
        })
        saved.push(item)
      } catch (err: any) {
        console.error(`[Collector] Failed to save item "${item.title}":`, err?.message)
      }
    }

    return saved
  }

  private extractCommentsCount(item: TrendData): number {
    let extra: any = {}
    try { extra = JSON.parse(item.extra || '{}') } catch {}

    switch (item.source) {
      case 'reddit':
        return extra.num_comments || 0
      case 'hackernews':
        return extra.comments || 0
      case 'v2ex':
        return extra.replies || 0
      case 'twitter':
        return (extra.likes || 0) + (extra.retweets || 0)
      case 'github':
        return extra.todayStars || 0
      case 'bilibili':
        return extra.likes || 0
      case 'huggingface':
        return extra.likes || extra.upvotes || 0
      default:
        return 0
    }
  }
}
