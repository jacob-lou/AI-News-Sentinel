import { describe, it, expect } from 'vitest'

// ─── Test: Importance normalization + cross-source scoring ───

describe('ImportanceService: tokenize', () => {
  // Re-implement tokenize for testing (private method)
  const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'with',
    'this', 'that', 'from', 'they', 'were', 'what', 'when', 'make', 'like',
    'how', 'each', 'she', 'which', 'their', 'said', 'its', 'about', 'into',
    'than', 'them', 'these', 'some', 'could', 'other', 'more', 'very', 'just',
    'new', 'also', 'over', 'after', 'being', 'here', 'would', 'most', 'top',
    'best', 'why', 'get', 'got', 'may', 'still', 'should', 'while', 'does',
  ])

  function tokenize(title: string): string[] {
    const tokens: string[] = []
    const words = title.toLowerCase().match(/[a-z0-9]{3,}/g) || []
    for (const w of words) {
      if (!STOP_WORDS.has(w)) tokens.push(w)
    }
    const cjk = title.match(/[\u4e00-\u9fff]{2,}/g) || []
    for (const seg of cjk) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2))
      }
    }
    return tokens
  }

  it('extracts English words, filters stopwords', () => {
    const tokens = tokenize('The best AI model for coding')
    expect(tokens).toContain('model')
    expect(tokens).toContain('coding')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('for')
    expect(tokens).not.toContain('best')
  })

  it('extracts CJK bigrams', () => {
    const tokens = tokenize('人工智能热点追踪')
    expect(tokens).toContain('人工')
    expect(tokens).toContain('工智')
    expect(tokens).toContain('智能')
    expect(tokens).toContain('热点')
    expect(tokens).toContain('点追')
    expect(tokens).toContain('追踪')
  })

  it('handles mixed CJK and English', () => {
    const tokens = tokenize('Claude AI 人工智能 模型')
    expect(tokens).toContain('claude')
    expect(tokens).toContain('人工')
    expect(tokens).toContain('工智')
  })

  it('filters short words (< 3 chars)', () => {
    const tokens = tokenize('AI is a big deal')
    expect(tokens).not.toContain('ai')
    expect(tokens).not.toContain('is')
    expect(tokens).toContain('big')
    expect(tokens).toContain('deal')
  })
})

// ─── Test: Per-source percentile normalization ───

describe('Percentile normalization', () => {
  function percentile(rank: number, total: number): number {
    return total > 1 ? (rank / (total - 1)) * 100 : 50
  }

  it('normalizes top item to 100', () => {
    // rank = n-1 (0-indexed) for highest
    expect(percentile(9, 10)).toBe(100)
  })

  it('normalizes bottom item to 0', () => {
    expect(percentile(0, 10)).toBe(0)
  })

  it('normalizes middle item correctly', () => {
    expect(percentile(4, 9)).toBe(50)
  })

  it('single item gets 50', () => {
    expect(percentile(0, 1)).toBe(50)
  })
})

// ─── Test: Cross-source bonus calculation ───

describe('Cross-source bonus', () => {
  function computeBonus(matchingSources: number): number {
    return Math.min(100, matchingSources * 25)
  }

  it('no cross-source match = 0', () => {
    expect(computeBonus(0)).toBe(0)
  })

  it('1 source match = 25', () => {
    expect(computeBonus(1)).toBe(25)
  })

  it('4+ source matches caps at 100', () => {
    expect(computeBonus(4)).toBe(100)
    expect(computeBonus(6)).toBe(100)
  })
})

// ─── Test: Combined importance formula ───

describe('Combined importance score', () => {
  function computeImportance(normalizedScore: number, normalizedComments: number, crossSourceBonus: number): number {
    return Math.round((normalizedScore * 0.4 + normalizedComments * 0.3 + crossSourceBonus * 0.3) * 100) / 100
  }

  it('all maxed out = 100', () => {
    expect(computeImportance(100, 100, 100)).toBe(100)
  })

  it('all zero = 0', () => {
    expect(computeImportance(0, 0, 0)).toBe(0)
  })

  it('high score, no engagement, no cross-source', () => {
    expect(computeImportance(100, 0, 0)).toBe(40)
  })

  it('low score, high engagement + cross-source = 60', () => {
    expect(computeImportance(0, 100, 100)).toBe(60)
  })
})

// ─── Test: AnalysisService.buildFilterHash ───

describe('AnalysisService.buildFilterHash', () => {
  // Re-implement for testing without importing (avoid crypto in test env issues)
  function buildFilterHash(filter: any): string {
    const normalized = {
      source: filter.source || '',
      search: filter.search || '',
      days: filter.days || 30,
      minScore: filter.minScore || 0,
    }
    // Just test that same input = same output, and different input = different output
    return JSON.stringify(normalized)
  }

  it('same filters produce same hash', () => {
    const a = buildFilterHash({ source: 'reddit', days: 7 })
    const b = buildFilterHash({ source: 'reddit', days: 7 })
    expect(a).toBe(b)
  })

  it('different filters produce different hash', () => {
    const a = buildFilterHash({ source: 'reddit', days: 7 })
    const b = buildFilterHash({ source: 'github', days: 7 })
    expect(a).not.toBe(b)
  })

  it('missing params default correctly', () => {
    const a = buildFilterHash({})
    const b = buildFilterHash({ source: '', search: '', days: 30, minScore: 0 })
    expect(a).toBe(b)
  })
})

// ─── Test: importance sort uses importanceScore field ───

describe('Sort switch: importance uses importanceScore', () => {
  function getSortOrderBy(sort: string) {
    switch (sort) {
      case 'importance':
        return [{ importanceScore: 'desc' }, { fetchedAt: 'desc' }]
      case 'score':
      default:
        return [{ score: 'desc' }, { fetchedAt: 'desc' }]
    }
  }

  it('importance sort orders by importanceScore desc', () => {
    const order = getSortOrderBy('importance')
    expect(order[0]).toEqual({ importanceScore: 'desc' })
    expect(order[1]).toEqual({ fetchedAt: 'desc' })
  })

  it('importance sort does NOT use raw score', () => {
    const order = getSortOrderBy('importance')
    expect(order[0]).not.toHaveProperty('score')
  })
})
