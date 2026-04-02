import prisma from '../db'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'with',
  'this', 'that', 'from', 'they', 'were', 'what', 'when', 'make', 'like',
  'how', 'each', 'she', 'which', 'their', 'said', 'its', 'about', 'into',
  'than', 'them', 'these', 'some', 'could', 'other', 'more', 'very', 'just',
  'new', 'also', 'over', 'after', 'being', 'here', 'would', 'most', 'top',
  'best', 'why', 'get', 'got', 'may', 'still', 'should', 'while', 'does',
])

export class ImportanceService {
  /** Extract searchable tokens from a title (words for latin, bigrams for CJK) */
  private static tokenize(title: string): string[] {
    const tokens: string[] = []

    // Extract non-CJK words (length > 2)
    const words = title.toLowerCase().match(/[a-z0-9]{3,}/g) || []
    for (const w of words) {
      if (!STOP_WORDS.has(w)) tokens.push(w)
    }

    // Extract CJK bigrams
    const cjk = title.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{2,}/g) || []
    for (const seg of cjk) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2))
      }
    }

    return tokens
  }

  /** Compute importance scores for all items within a time window */
  async computeScores(days: number = 30): Promise<number> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const items = await prisma.trendItem.findMany({
      where: {
        OR: [
          { publishedAt: { gte: since } },
          { publishedAt: null, fetchedAt: { gte: since } },
        ],
      },
      select: { id: true, title: true, source: true, score: true, commentsCount: true },
    })

    if (items.length === 0) return 0

    // Step 1: Per-source percentile normalization for score and commentsCount
    const bySource = new Map<string, typeof items>()
    for (const item of items) {
      const list = bySource.get(item.source) || []
      list.push(item)
      bySource.set(item.source, list)
    }

    const normalizedScore = new Map<number, number>()
    const normalizedComments = new Map<number, number>()

    for (const [, sourceItems] of bySource) {
      const n = sourceItems.length

      const sortedByScore = [...sourceItems].sort((a, b) => a.score - b.score)
      for (let i = 0; i < n; i++) {
        normalizedScore.set(sortedByScore[i].id, n > 1 ? (i / (n - 1)) * 100 : 50)
      }

      const sortedByComments = [...sourceItems].sort((a, b) => a.commentsCount - b.commentsCount)
      for (let i = 0; i < n; i++) {
        normalizedComments.set(sortedByComments[i].id, n > 1 ? (i / (n - 1)) * 100 : 50)
      }
    }

    // Step 2: Cross-source frequency bonus via inverted token index
    const tokenSources = new Map<string, Set<string>>()
    const itemTokens = new Map<number, string[]>()

    for (const item of items) {
      const tokens = ImportanceService.tokenize(item.title)
      itemTokens.set(item.id, tokens)
      for (const token of tokens) {
        let sources = tokenSources.get(token)
        if (!sources) {
          sources = new Set()
          tokenSources.set(token, sources)
        }
        sources.add(item.source)
      }
    }

    const crossSourceBonus = new Map<number, number>()
    for (const item of items) {
      const tokens = itemTokens.get(item.id) || []
      const matchingSources = new Set<string>()
      for (const token of tokens) {
        const sources = tokenSources.get(token)
        if (sources && sources.size > 1) {
          for (const s of sources) {
            if (s !== item.source) matchingSources.add(s)
          }
        }
      }
      // 0 for no cross-source match, up to 100 for 4+ source matches
      crossSourceBonus.set(item.id, Math.min(100, matchingSources.size * 25))
    }

    // Step 3: Combined score = normalizedScore*0.4 + normalizedComments*0.3 + crossSourceBonus*0.3
    // Also track crossSourceCount for frontend display
    const crossSourceCount = new Map<number, number>()
    for (const item of items) {
      const tokens = itemTokens.get(item.id) || []
      const matchingSources = new Set<string>()
      for (const token of tokens) {
        const sources = tokenSources.get(token)
        if (sources && sources.size > 1) {
          for (const s of sources) {
            if (s !== item.source) matchingSources.add(s)
          }
        }
      }
      crossSourceCount.set(item.id, matchingSources.size)
    }

    const updates: { id: number; importanceScore: number; crossSourceCount: number }[] = []
    for (const item of items) {
      const ns = normalizedScore.get(item.id) || 0
      const nc = normalizedComments.get(item.id) || 0
      const csb = crossSourceBonus.get(item.id) || 0
      const importance = ns * 0.4 + nc * 0.3 + csb * 0.3
      updates.push({
        id: item.id,
        importanceScore: Math.round(importance * 100) / 100,
        crossSourceCount: crossSourceCount.get(item.id) || 0,
      })
    }

    // Batch update in chunks
    const CHUNK_SIZE = 500
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(u => prisma.trendItem.update({
          where: { id: u.id },
          data: { importanceScore: u.importanceScore, crossSourceCount: u.crossSourceCount },
        }))
      )
    }

    console.log(`[Importance] Computed scores for ${updates.length} items`)
    return updates.length
  }
}
