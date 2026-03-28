import prisma from '../db'
import { KeywordSearchService, KeywordSearchResult } from './keyword-search'
import { getIO } from '../socket'

export class MonitorService {
  private searchService = new KeywordSearchService()
  private apiKey: string | null = null
  private model: string

  constructor() {
    const key = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
    if (key && key !== 'your_openrouter_api_key_here') {
      this.apiKey = key
    }
  }

  /** Run monitoring check for all active keywords */
  async checkAllKeywords(): Promise<void> {
    const keywords = await prisma.monitorKeyword.findMany({ where: { active: true } })
    if (keywords.length === 0) return

    console.log(`[Monitor] Checking ${keywords.length} active keywords...`)

    for (const kw of keywords) {
      try {
        await this.checkKeyword(kw.id, kw.keyword)
      } catch (err: any) {
        console.error(`[Monitor] Error checking "${kw.keyword}":`, err?.message)
      }
    }
  }

  /** Check a single keyword: search, verify with AI, save alerts, notify */
  private async checkKeyword(keywordId: number, keyword: string): Promise<void> {
    const results = await this.searchService.searchAll(keyword)
    if (results.length === 0) return

    // Deduplicate against existing alerts (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const existingAlerts = await prisma.keywordAlert.findMany({
      where: { keywordId, createdAt: { gte: since } },
      select: { title: true },
    })
    const existingTitles = new Set(existingAlerts.map((a) => a.title.toLowerCase()))

    const newResults = results.filter((r) => !existingTitles.has(r.title.toLowerCase()))
    if (newResults.length === 0) return

    // AI verification: batch verify which results are genuinely related
    const verified = await this.verifyWithAI(keyword, newResults)

    // Save verified alerts
    const savedAlerts: any[] = []
    for (const item of verified) {
      try {
        const alert = await prisma.keywordAlert.create({
          data: {
            keywordId,
            title: item.title,
            url: item.url,
            source: item.source,
            snippet: item.snippet,
            verified: item.verified,
            aiReason: item.reason,
            notified: false,
          },
        })
        if (item.verified) {
          savedAlerts.push(alert)
        }
      } catch (err: any) {
        console.error(`[Monitor] Failed to save alert:`, err?.message)
      }
    }

    // Send real-time notifications for verified alerts
    if (savedAlerts.length > 0) {
      const io = getIO()
      if (io) {
        io.emit('keyword-alert', {
          keyword,
          keywordId,
          alerts: savedAlerts,
          timestamp: new Date().toISOString(),
        })
      }
      // Mark as notified
      await prisma.keywordAlert.updateMany({
        where: { id: { in: savedAlerts.map((a) => a.id) } },
        data: { notified: true },
      })
      console.log(`[Monitor] "${keyword}": ${savedAlerts.length} new verified alerts sent`)
    }
  }

  /** Use AI to verify if search results genuinely relate to the keyword */
  private async verifyWithAI(
    keyword: string,
    results: KeywordSearchResult[]
  ): Promise<Array<KeywordSearchResult & { verified: boolean; reason: string }>> {
    if (!this.apiKey || results.length === 0) {
      // No AI configured: mark all as verified with disclaimer
      return results.map((r) => ({ ...r, verified: true, reason: '未配置AI，跳过验证' }))
    }

    // Take top 20 results to avoid token overflow
    const batch = results.slice(0, 20)

    const itemsList = batch
      .map((r, i) => `${i + 1}. [${r.source}] ${r.title}${r.snippet ? ' — ' + r.snippet.slice(0, 100) : ''}`)
      .join('\n')

    const prompt = `你是一个内容审核专家。用户正在监控关键词「${keyword}」。

以下是从多个平台搜索到的内容，请逐条判断每条内容是否**真正**与「${keyword}」相关。

需要识别并过滤掉：
1. 标题党/误导性内容（关键词出现但内容实际无关）
2. 重复/低质量内容
3. 广告或垃圾信息
4. 关键词碰巧出现但语境无关的内容

返回 JSON 数组格式：
[
  { "index": 1, "verified": true, "reason": "一句话说明判断原因" },
  { "index": 2, "verified": false, "reason": "标题党，实际内容与关键词无关" }
]

只返回 JSON，不要其他内容。

搜索结果：
${itemsList}`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-Title': 'TrendTracker-Monitor',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        console.error(`[Monitor] AI verification failed: ${response.status}`)
        return batch.map((r) => ({ ...r, verified: true, reason: 'AI验证失败，默认通过' }))
      }

      const completion = await response.json()
      const content = completion.choices?.[0]?.message?.content
      if (!content) {
        return batch.map((r) => ({ ...r, verified: true, reason: 'AI无响应' }))
      }

      const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      const verdicts: Array<{ index: number; verified: boolean; reason: string }> = JSON.parse(jsonStr)

      const verdictMap = new Map(verdicts.map((v) => [v.index, v]))

      return batch.map((r, i) => {
        const v = verdictMap.get(i + 1)
        return {
          ...r,
          verified: v?.verified ?? true,
          reason: v?.reason ?? '未匹配AI结果',
        }
      })
    } catch (err: any) {
      console.error('[Monitor] AI verification error:', err?.message)
      return batch.map((r) => ({ ...r, verified: true, reason: 'AI验证异常' }))
    }
  }

  /** Collect keyword-scoped trends */
  async collectKeywordTrends(): Promise<void> {
    const keywords = await prisma.monitorKeyword.findMany({ where: { active: true } })
    if (keywords.length === 0) return

    console.log(`[Monitor] Collecting trends for ${keywords.length} keywords...`)

    for (const kw of keywords) {
      try {
        const results = await this.searchService.searchAll(kw.keyword)
        let savedCount = 0

        for (const item of results) {
          try {
            // Upsert by keyword + title + source to avoid duplicates
            const existing = await prisma.keywordTrend.findFirst({
              where: {
                keywordId: kw.id,
                title: item.title,
                source: item.source,
                fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            })
            if (!existing) {
              await prisma.keywordTrend.create({
                data: {
                  keywordId: kw.id,
                  title: item.title,
                  url: item.url,
                  source: item.source,
                  score: item.score,
                  extra: item.extra,
                },
              })
              savedCount++
            }
          } catch {}
        }

        console.log(`[Monitor] "${kw.keyword}": saved ${savedCount} new trends`)
      } catch (err: any) {
        console.error(`[Monitor] Error collecting for "${kw.keyword}":`, err?.message)
      }
    }

    // Notify frontend
    const io = getIO()
    if (io) {
      io.emit('keyword-trends-update', { timestamp: new Date().toISOString() })
    }
  }
}
