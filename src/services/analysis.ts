import prisma from '../db'
import { createHash } from 'crypto'

export interface AnalysisFilter {
  category?: string
  source?: string
  search?: string
  days?: number
  minScore?: number
}

export class AnalysisService {
  private apiKey: string | null = null
  private model: string

  constructor() {
    const key = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'

    if (key && key !== 'your_openrouter_api_key_here') {
      this.apiKey = key
    }
  }

  get isConfigured(): boolean {
    return this.apiKey !== null
  }

  /** Build a deterministic hash from filter params for cache lookup */
  static buildFilterHash(filter: AnalysisFilter): string {
    const normalized = {
      source: filter.source || '',
      search: filter.search || '',
      days: filter.days || 30,
      minScore: filter.minScore || 0,
    }
    return createHash('md5').update(JSON.stringify(normalized)).digest('hex').substring(0, 12)
  }

  /** Build Prisma where clause matching the trends route logic */
  private buildWhere(filter: AnalysisFilter): any {
    const where: any = {}

    if (filter.category === 'ai' || filter.category === 'general') {
      where.category = filter.category
    }

    if (filter.source) {
      const sources = filter.source.split(',').map(s => s.trim()).filter(Boolean)
      if (sources.length === 1) {
        where.source = sources[0]
      } else if (sources.length > 1) {
        where.source = { in: sources }
      }
    }

    if (filter.search) {
      where.title = { contains: filter.search }
    }

    if (filter.minScore && filter.minScore > 0) {
      where.score = { gte: filter.minScore }
    }

    const maxAgeDays = Math.min(90, Math.max(1, filter.days || 30))
    const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    where.OR = [
      { publishedAt: { gte: since } },
      { publishedAt: null, fetchedAt: { gte: since } },
    ]

    return where
  }

  async analyzeTrends(filter: AnalysisFilter = {}): Promise<{ summary: string; topics: any[] } | null> {
    if (!this.apiKey) {
      console.warn('[Analysis] OpenRouter API key not configured')
      return null
    }

    const category = filter.category || 'all'
    const filterHash = AnalysisService.buildFilterHash(filter)

    const where = this.buildWhere(filter)
    const recentTrends = await prisma.trendItem.findMany({
      where,
      orderBy: [{ score: 'desc' }, { fetchedAt: 'desc' }],
      take: 80,
      select: { title: true, source: true, score: true },
    })

    if (recentTrends.length === 0) return null

    const trendsList = recentTrends
      .map((t) => `[${t.source}] ${t.title} (score: ${t.score})`)
      .join('\n')

    const categoryLabel = category === 'ai' ? 'AI/科技' : category === 'general' ? '综合' : '全部'

    const prompt = `你是一个热点分析专家。以下是从多个平台采集到的【${categoryLabel}】类最新热点数据。

请分析这些热点，返回以下 JSON 格式：
{
  "summary": "用中文写一段 2-3 句话的整体趋势概述",
  "topics": [
    {
      "name": "话题名称",
      "heat": "high/medium/low",
      "description": "一句话描述",
      "sources": ["来源1", "来源2"]
    }
  ]
}

要求：
1. 提取 5-8 个最核心的热门话题
2. 合并不同来源中重复或相关的话题
3. 按热度从高到低排列
4. 只返回 JSON，不要其他内容

热点数据：
${trendsList}`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-Title': 'TrendTracker',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter API error ${response.status}: ${errText}`)
      }

      const completion: any = await response.json()
      const content = completion.choices?.[0]?.message?.content
      if (!content) return null

      // Parse the JSON response (strip markdown code fences if present)
      const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      const result = JSON.parse(jsonStr)

      // Save to database with category and filterHash
      await prisma.trendAnalysis.create({
        data: {
          summary: result.summary || '',
          topics: JSON.stringify(result.topics || []),
          model: this.model,
          category,
          filterHash,
        },
      })

      console.log(`[Analysis] Generated ${categoryLabel} analysis with ${result.topics?.length || 0} topics (hash: ${filterHash})`)
      return result
    } catch (err: any) {
      console.error('[Analysis] Failed:', err?.message || err)
      return null
    }
  }

  async getLatestAnalysis(category?: string, filterHash?: string) {
    const where: any = {}
    if (category) where.category = category
    if (filterHash) where.filterHash = filterHash

    const analysis = await prisma.trendAnalysis.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    })

    if (!analysis) return null

    return {
      id: analysis.id,
      summary: analysis.summary,
      topics: JSON.parse(analysis.topics),
      model: analysis.model,
      createdAt: analysis.createdAt,
      category: analysis.category,
      filterHash: analysis.filterHash,
    }
  }
}
