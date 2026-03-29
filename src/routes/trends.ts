import { Router, Request, Response } from 'express'
import prisma from '../db'
import { AnalysisService } from '../services/analysis'

const router = Router()

// GET /api/trends - 获取热点列表（分页、筛选来源）
router.get('/trends', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50))
  const source = req.query.source as string | undefined
  const skip = (page - 1) * limit

  const where: any = source ? { source } : {}

  // 默认排除30天前的旧内容
  const maxAgeDays = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30))
  const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  where.OR = [
    { publishedAt: { gte: since } },
    { publishedAt: null, fetchedAt: { gte: since } },
  ]

  const [items, total] = await Promise.all([
    prisma.trendItem.findMany({
      where,
      orderBy: [{ score: 'desc' }, { fetchedAt: 'desc' }],
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

// GET /api/trends/sources - 获取所有来源
router.get('/trends/sources', async (_req: Request, res: Response) => {
  const sources = await prisma.trendItem.findMany({
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

// GET /api/trends/analysis - 获取最新 AI 分析
router.get('/trends/analysis', async (_req: Request, res: Response) => {
  const service = new AnalysisService()
  const analysis = await service.getLatestAnalysis()
  res.json({ analysis, configured: service.isConfigured })
})

// POST /api/trends/analyze - 手动触发 AI 分析
router.post('/trends/analyze', async (_req: Request, res: Response) => {
  const service = new AnalysisService()
  if (!service.isConfigured) {
    res.status(400).json({ error: 'OpenRouter API key not configured' })
    return
  }
  res.json({ message: 'Analysis started' })

  const result = await service.analyzeTrends()
  const { getIO } = require('../socket')
  const io = getIO()
  if (io && result) {
    io.emit('analysis-update', { analysis: result, timestamp: new Date().toISOString() })
  }
})

export default router
