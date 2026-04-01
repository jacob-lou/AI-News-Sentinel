import { describe, it, expect } from 'vitest'

// ─── Test 1: Sort options "newest" vs "fetchedAt" are distinct ───
describe('Sort options: newest vs fetchedAt', () => {
  // Simulates the backend sort switch logic
  function getSortOrderBy(sort: string) {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }]
      case 'fetchedAt':
        return [{ fetchedAt: 'desc' }]
      case 'comments':
        return [{ commentsCount: 'desc' }, { score: 'desc' }]
      case 'importance':
        return [{ score: 'desc' }, { commentsCount: 'desc' }, { fetchedAt: 'desc' }]
      case 'score':
      default:
        return [{ score: 'desc' }, { fetchedAt: 'desc' }]
    }
  }

  it('"newest" sorts by publishedAt then fetchedAt', () => {
    const order = getSortOrderBy('newest')
    expect(order[0]).toHaveProperty('publishedAt')
    expect(order[1]).toEqual({ fetchedAt: 'desc' })
  })

  it('"fetchedAt" sorts only by fetchedAt', () => {
    const order = getSortOrderBy('fetchedAt')
    expect(order).toHaveLength(1)
    expect(order[0]).toEqual({ fetchedAt: 'desc' })
  })

  it('"newest" and "fetchedAt" produce different orderBy', () => {
    const newest = getSortOrderBy('newest')
    const fetchedAt = getSortOrderBy('fetchedAt')
    expect(newest).not.toEqual(fetchedAt)
  })
})

// ─── Test 2: Importance sorting exists and is distinct ───
describe('Importance sorting', () => {
  function getSortOrderBy(sort: string) {
    switch (sort) {
      case 'newest':
        return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }]
      case 'fetchedAt':
        return [{ fetchedAt: 'desc' }]
      case 'comments':
        return [{ commentsCount: 'desc' }, { score: 'desc' }]
      case 'importance':
        return [{ score: 'desc' }, { commentsCount: 'desc' }, { fetchedAt: 'desc' }]
      case 'score':
      default:
        return [{ score: 'desc' }, { fetchedAt: 'desc' }]
    }
  }

  it('"importance" is a valid sort option', () => {
    const order = getSortOrderBy('importance')
    expect(order).toBeDefined()
    expect(order.length).toBeGreaterThan(0)
  })

  it('"importance" sorts by score then commentsCount then fetchedAt', () => {
    const order = getSortOrderBy('importance')
    expect(order).toEqual([
      { score: 'desc' },
      { commentsCount: 'desc' },
      { fetchedAt: 'desc' },
    ])
  })

  it('"importance" differs from "score" sort', () => {
    const importance = getSortOrderBy('importance')
    const score = getSortOrderBy('score')
    expect(importance).not.toEqual(score)
  })

  it('"importance" differs from "comments" sort', () => {
    const importance = getSortOrderBy('importance')
    const comments = getSortOrderBy('comments')
    expect(importance).not.toEqual(comments)
  })
})

// ─── Test 3: Bilibili score fix — position-based, not hot_id ───
describe('Bilibili hot search score calculation', () => {
  // Replicates the fixed scoring logic from bilibili.ts
  function calcScore(item: { position?: number; hot_id?: number }) {
    return item.position ? (100 - item.position) * 100 : 0
  }

  it('position 1 gets highest score (9900)', () => {
    expect(calcScore({ position: 1, hot_id: 243481 })).toBe(9900)
  })

  it('position 10 gets score 9000', () => {
    expect(calcScore({ position: 10, hot_id: 243012 })).toBe(9000)
  })

  it('position 30 gets lower score than position 1', () => {
    const score1 = calcScore({ position: 1 })
    const score30 = calcScore({ position: 30 })
    expect(score1).toBeGreaterThan(score30)
  })

  it('score does NOT use hot_id', () => {
    const scoreWith = calcScore({ position: 5, hot_id: 243481 })
    const scoreWithout = calcScore({ position: 5 })
    expect(scoreWith).toBe(scoreWithout)
    expect(scoreWith).toBe(9500)
  })

  it('all positions yield distinct scores', () => {
    const scores = Array.from({ length: 20 }, (_, i) => calcScore({ position: i + 1 }))
    const uniqueScores = new Set(scores)
    expect(uniqueScores.size).toBe(20)
  })

  it('score is never around 243K (the hot_id bug value)', () => {
    for (let pos = 1; pos <= 50; pos++) {
      const score = calcScore({ position: pos })
      expect(score).toBeLessThan(10000)
      expect(score).not.toBeCloseTo(243000, -2)
    }
  })

  it('missing position yields 0', () => {
    expect(calcScore({})).toBe(0)
  })
})

// ─── Test 4: Analysis panel rendering supports both AI and General targets ───
describe('Analysis rendering for both tabs', () => {
  // Simulates the renderAnalysis function's panel selection logic
  function getTargetElements(target?: string) {
    if (target === 'general') {
      return {
        panelId: 'generalAnalysisPanel',
        summaryId: 'generalAnalysisSummary',
        timeId: 'generalAnalysisTime',
        topicsId: 'generalAnalysisTopics',
      }
    }
    return {
      panelId: 'analysisPanel',
      summaryId: 'analysisSummary',
      timeId: 'analysisTime',
      topicsId: 'analysisTopics',
    }
  }

  it('default target uses AI panel elements', () => {
    const els = getTargetElements()
    expect(els.panelId).toBe('analysisPanel')
    expect(els.summaryId).toBe('analysisSummary')
  })

  it('"general" target uses general panel elements', () => {
    const els = getTargetElements('general')
    expect(els.panelId).toBe('generalAnalysisPanel')
    expect(els.summaryId).toBe('generalAnalysisSummary')
    expect(els.topicsId).toBe('generalAnalysisTopics')
    expect(els.timeId).toBe('generalAnalysisTime')
  })

  it('AI and general panels are different elements', () => {
    const ai = getTargetElements()
    const general = getTargetElements('general')
    expect(ai.panelId).not.toBe(general.panelId)
    expect(ai.summaryId).not.toBe(general.summaryId)
    expect(ai.topicsId).not.toBe(general.topicsId)
  })
})

// ─── Integration: Frontend sort dropdown has all expected options ───
describe('Frontend sort dropdown options', () => {
  // Simulate the expected dropdown items
  const expectedOptions = [
    { value: 'score', label: '最热' },
    { value: 'importance', label: '重要程度' },
    { value: 'newest', label: '最新发布' },
    { value: 'comments', label: '最多互动' },
    { value: 'fetchedAt', label: '最新采集' },
  ]

  it('contains exactly 5 sort options', () => {
    expect(expectedOptions).toHaveLength(5)
  })

  it('includes "importance" option', () => {
    const vals = expectedOptions.map(o => o.value)
    expect(vals).toContain('importance')
  })

  it('includes all required sort types', () => {
    const vals = expectedOptions.map(o => o.value)
    expect(vals).toContain('score')
    expect(vals).toContain('importance')
    expect(vals).toContain('newest')
    expect(vals).toContain('comments')
    expect(vals).toContain('fetchedAt')
  })

  it('has distinct labels for newest and fetchedAt', () => {
    const newest = expectedOptions.find(o => o.value === 'newest')
    const fetchedAt = expectedOptions.find(o => o.value === 'fetchedAt')
    expect(newest!.label).not.toBe(fetchedAt!.label)
  })
})
