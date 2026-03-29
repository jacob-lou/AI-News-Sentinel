import { TrendSource, TrendData } from './base'

interface HFModel {
  id: string
  likes: number
  trendingScore: number
  tags?: string[]
  lastModified?: string
  author?: string
  pipeline_tag?: string
}

interface HFPaper {
  title: string
  paper: {
    id: string
    title: string
    summary?: string
    upvotes: number
    publishedAt?: string
  }
  publishedAt?: string
}

export class HuggingFaceSource implements TrendSource {
  name = 'huggingface'

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []

    // 1. 热门模型
    try {
      const res = await fetch('https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20')
      if (res.ok) {
        const models = await res.json() as HFModel[]
        for (const model of models) {
          if (!model.id) continue
          items.push({
            title: model.id,
            url: `https://huggingface.co/${model.id}`,
            source: this.name,
            score: model.trendingScore || model.likes || 0,
            externalId: `hf-model-${model.id.toLowerCase().replace(/\//g, '-')}`,
            publishedAt: model.lastModified ? new Date(model.lastModified) : undefined,
            extra: JSON.stringify({
              type: 'model',
              likes: model.likes,
              trendingScore: model.trendingScore,
              author: model.author || model.id.split('/')[0],
              pipeline: model.pipeline_tag,
              tags: (model.tags || []).slice(0, 10),
            }),
          })
        }
      }
    } catch (err) {
      console.error('[HuggingFace] Failed to fetch models:', err)
    }

    // 2. 每日论文（高 upvote 的）
    try {
      const res = await fetch('https://huggingface.co/api/daily_papers')
      if (res.ok) {
        const papers = await res.json() as HFPaper[]
        // 只取有一定热度的论文
        const hotPapers = papers.filter(p => (p.paper?.upvotes || 0) >= 3)
        for (const p of hotPapers.slice(0, 15)) {
          const title = p.title || p.paper?.title || ''
          if (!title) continue
          items.push({
            title: title,
            url: `https://huggingface.co/papers/${p.paper?.id || ''}`,
            source: this.name,
            score: p.paper?.upvotes || 0,
            externalId: `hf-paper-${(p.paper?.id || title).toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 80)}`,
            publishedAt: p.publishedAt ? new Date(p.publishedAt) : (p.paper?.publishedAt ? new Date(p.paper.publishedAt) : undefined),
            extra: JSON.stringify({
              type: 'paper',
              upvotes: p.paper?.upvotes,
              summary: (p.paper?.summary || '').substring(0, 300),
            }),
          })
        }
      }
    } catch (err) {
      console.error('[HuggingFace] Failed to fetch papers:', err)
    }

    return items
  }
}
