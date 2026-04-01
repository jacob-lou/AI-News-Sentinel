import { Router, Request, Response } from 'express'
import prisma from '../db'
import { AnalysisService, AnalysisFilter } from '../services/analysis'
import { ClassifierService } from '../services/classifier'
import { ImportanceService } from '../services/importance'

const router = Router()

// GET /api/trends - 获取热点列表（分页、筛选来源、分类、排序、搜索）
router.get('/trends', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
  const source = req.query.source as string | undefined
  const category = req.query.category as string | undefined
  const sort = (req.query.sort as string) || 'score'
  const search = (req.query.search as string || '').trim()
  const minScore = parseInt(req.query.minScore as string) || 0
  const hasUrl = req.query.hasUrl === 'true'
  const skip = (page - 1) * limit

  // AI 相关数据源 — now uses DB category field
  // const AI_SOURCES = ['github', 'huggingface', 'hackernews', 'twitter', 'bingnews']
  // const GENERAL_SOURCES = ['google', 'reddit', 'duckduckgo', 'v2ex', 'bilibili']

  const where: any = {}

  // 按分类筛选（基于 category 字段）
  if (category === 'ai' || category === 'general') {
    where.category = category
  }

  // 来源筛选（支持逗号分隔多源）
  if (source) {
    const sources = source.split(',').map(s => s.trim()).filter(Boolean)
    if (sources.length === 1) {
      where.source = sources[0]
    } else if (sources.length > 1) {
      where.source = { in: sources }
    }
  }

  // 标题搜索
  if (search) {
    where.title = { contains: search }
  }

  // 热度门槛
  if (minScore > 0) {
    where.score = { gte: minScore }
  }

  // 仅有链接
  if (hasUrl) {
    where.url = { not: null }
  }

  // 默认排除N天前的旧内容
  const maxAgeDays = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30))
  const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  where.OR = [
    { publishedAt: { gte: since } },
    { publishedAt: null, fetchedAt: { gte: since } },
  ]

  // 排序
  let orderBy: any[]
  switch (sort) {
    case 'newest':
      orderBy = [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }]
      break
    case 'comments':
      orderBy = [{ commentsCount: 'desc' }, { score: 'desc' }]
      break
    case 'fetchedAt':
      orderBy = [{ fetchedAt: 'desc' }]
      break
    case 'importance':
      orderBy = [{ importanceScore: 'desc' }, { fetchedAt: 'desc' }]
      break
    case 'score':
    default:
      orderBy = [{ score: 'desc' }, { fetchedAt: 'desc' }]
      break
  }

  const [items, total] = await Promise.all([
    prisma.trendItem.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.trendItem.count({ where }),
  ])

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// GET /api/trends/sources - 获取来源（支持按分类筛选）
router.get('/trends/sources', async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined
  const where: any = {}
  if (category === 'ai' || category === 'general') {
    where.category = category
  }

  const sources = await prisma.trendItem.findMany({
    where,
    select: { source: true },
    distinct: ['source'],
  })

  res.json({
    sources: sources.map((s) => s.source),
  })
})

// GET /api/trends/stats - 采集统计
router.get('/trends/stats', async (_req: Request, res: Response) => {
  const logs = await prisma.fetchLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const totalItems = await prisma.trendItem.count()

  res.json({
    totalItems,
    recentLogs: logs,
  })
})

// POST /api/trends/refresh - 手动触发采集
router.post('/trends/refresh', async (_req: Request, res: Response) => {
  // This will be handled by the socket/scheduler module
  // We emit an event that the scheduler picks up
  const { getIO } = require('../socket')
  const { CollectorService } = require('../services/collector')

  res.json({ message: 'Refresh started' })

  // Run collection in background
  const collector = new CollectorService()
  const results = await collector.collectAll()

  // Compute importance scores
  try {
    const importance = new ImportanceService()
    await importance.computeScores()
  } catch {}

  const io = getIO()
  if (io) {
    const allItems = results.flatMap((r: any) => r.items)
    if (allItems.length > 0) {
      io.emit('new-trends', { items: allItems, timestamp: new Date().toISOString() })
    }
    io.emit('fetch-status', {
      results: results.map((r: any) => ({
        source: r.source,
        count: r.items.length,
        error: r.error,
      })),
      timestamp: new Date().toISOString(),
    })
  }
})

// GET /api/trends/analysis - 获取最新 AI 分析（支持按筛选条件查询缓存）
router.get('/trends/analysis', async (req: Request, res: Response) => {
  const service = new AnalysisService()
  const filter: AnalysisFilter = {
    category: req.query.category as string,
    source: req.query.source as string,
    search: req.query.search as string,
    days: req.query.days ? parseInt(req.query.days as string) : undefined,
    minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
  }
  const category = filter.category || 'all'
  const filterHash = AnalysisService.buildFilterHash(filter)
  const analysis = await service.getLatestAnalysis(category, filterHash)
  res.json({ analysis, configured: service.isConfigured })
})

// POST /api/trends/analyze - 手动触发 AI 分析（支持筛选条件）
router.post('/trends/analyze', async (req: Request, res: Response) => {
  const service = new AnalysisService()
  if (!service.isConfigured) {
    res.status(400).json({ error: 'OpenRouter API key not configured' })
    return
  }

  const filter: AnalysisFilter = {
    category: req.body.category,
    source: req.body.source,
    search: req.body.search,
    days: req.body.days ? parseInt(req.body.days) : undefined,
    minScore: req.body.minScore ? parseInt(req.body.minScore) : undefined,
  }

  res.json({ message: 'Analysis started' })

  const result = await service.analyzeTrends(filter)
  const { getIO } = require('../socket')
  const io = getIO()
  if (io && result) {
    io.emit('analysis-update', {
      analysis: result,
      category: filter.category || 'all',
      timestamp: new Date().toISOString(),
    })
  }
})

// POST /api/trends/backfill-categories - 重新分类所有现有数据
router.post('/trends/backfill-categories', async (_req: Request, res: Response) => {
  const classifier = new ClassifierService()
  res.json({ message: 'Backfill started' })

  try {
    const result = await classifier.backfill()
    console.log(`[Backfill] Done: ${result.total} processed, ${result.aiCount} classified as AI`)
  } catch (err: any) {
    console.error('[Backfill] Failed:', err?.message || err)
  }
})

export default router
