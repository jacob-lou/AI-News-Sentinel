import { Router, Request, Response } from 'express'
import prisma from '../db'
import { MonitorService } from '../services/monitor'

const router = Router()

// GET /api/keywords - 获取所有监控关键词
router.get('/keywords', async (_req: Request, res: Response) => {
  const keywords = await prisma.monitorKeyword.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { alerts: true, trends: true } },
    },
  })
  res.json({ keywords })
})

// POST /api/keywords - 添加监控关键词
router.post('/keywords', async (req: Request, res: Response) => {
  const { keyword, scope } = req.body
  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
    res.status(400).json({ error: '关键词不能为空' })
    return
  }

  const trimmed = keyword.trim().slice(0, 100)
  try {
    const kw = await prisma.monitorKeyword.create({
      data: {
        keyword: trimmed,
        scope: scope || 'general',
      },
    })
    res.json({ keyword: kw })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: '该关键词已存在' })
      return
    }
    throw err
  }
})

// DELETE /api/keywords/:id - 删除监控关键词
// Static routes MUST come before :id routes to avoid matching "alerts" as :id

// GET /api/keywords/alerts/recent - 获取所有最近告警
router.get('/keywords/alerts/recent', async (_req: Request, res: Response) => {
  const alerts = await prisma.keywordAlert.findMany({
    where: { verified: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { keyword: { select: { keyword: true } } },
  })
  res.json({ alerts })
})

// POST /api/keywords/check - 手动触发关键词检查
router.post('/keywords/check', async (_req: Request, res: Response) => {
  res.json({ message: 'Keyword check started' })
  const monitor = new MonitorService()
  await monitor.checkAllKeywords()
})

// POST /api/keywords/collect - 手动触发关键词热点采集
router.post('/keywords/collect', async (_req: Request, res: Response) => {
  res.json({ message: 'Keyword trends collection started' })
  const monitor = new MonitorService()
  await monitor.collectKeywordTrends()
})

// DELETE /api/keywords/:id - 删除监控关键词
router.delete('/keywords/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ error: '无效的ID' })
    return
  }
  await prisma.monitorKeyword.delete({ where: { id } })
  res.json({ success: true })
})

// PATCH /api/keywords/:id - 更新关键词（启用/禁用）
router.patch('/keywords/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ error: '无效的ID' })
    return
  }
  const { active, scope } = req.body
  const data: any = {}
  if (typeof active === 'boolean') data.active = active
  if (typeof scope === 'string') data.scope = scope

  const kw = await prisma.monitorKeyword.update({ where: { id }, data })
  res.json({ keyword: kw })
})

// GET /api/keywords/:id/alerts - 获取某个关键词的告警
router.get('/keywords/:id/alerts', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ error: '无效的ID' })
    return
  }
  const onlyVerified = req.query.verified === 'true'

  const where: any = { keywordId: id }
  if (onlyVerified) where.verified = true

  const alerts = await prisma.keywordAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ alerts })
})

// GET /api/keywords/:id/trends - 获取关键词范围内的热点（支持排序、筛选）
router.get('/keywords/:id/trends', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    res.status(400).json({ error: '无效的ID' })
    return
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30))
  const sort = (req.query.sort as string) || 'fetchedAt'
  const source = req.query.source as string | undefined
  const search = (req.query.search as string || '').trim()
  const skip = (page - 1) * limit

  const where: any = { keywordId: id }

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

  // 时间范围
  const days = parseInt(req.query.days as string)
  if (days > 0) {
    const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000)
    where.fetchedAt = { gte: since }
  }

  // 排序
  let orderBy: any[]
  switch (sort) {
    case 'score':
      orderBy = [{ score: 'desc' }, { fetchedAt: 'desc' }]
      break
    case 'fetchedAt':
    default:
      orderBy = [{ fetchedAt: 'desc' }]
      break
  }

  const [items, total] = await Promise.all([
    prisma.keywordTrend.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.keywordTrend.count({ where }),
  ])

  res.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

export default router
