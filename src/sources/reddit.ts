import { TrendSource, TrendData } from './base'

interface RedditPost {
  data: {
    id: string
    title: string
    score: number
    num_comments: number
    permalink: string
    subreddit: string
    url: string
    created_utc: number
  }
}

interface RedditResponse {
  data: {
    children: RedditPost[]
  }
}

// AI/科技方向的子版块 — 核心 AI 社区
const TECH_SUBREDDITS = [
  'artificial',
  'MachineLearning',
  'LocalLLaMA',
  'ChatGPT',
  'OpenAI',
  'ClaudeAI',
  'singularity',
  'StableDiffusion',
  'deeplearning',
  'LangChain',
  'Futurology',
]

// 质量过滤阈值
const MIN_SCORE = 50
const MIN_COMMENTS = 5
// 最多回溯30天
const MAX_AGE_DAYS = 30

export class RedditSource implements TrendSource {
  name = 'reddit'

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []
    const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400

    for (const sub of TECH_SUBREDDITS) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=25&t=week`,
          { headers: { 'User-Agent': 'TrendTracker/1.0' } }
        )

        if (!response.ok) continue

        const data = await response.json() as RedditResponse

        for (const post of data.data.children) {
          const { id, title, score, num_comments, permalink, subreddit, created_utc } = post.data

          // 质量过滤：最低分数和评论数
          if (score < MIN_SCORE || num_comments < MIN_COMMENTS) continue
          // 时间过滤：排除太旧的帖子
          if (created_utc < cutoff) continue

          items.push({
            title,
            url: `https://www.reddit.com${permalink}`,
            source: this.name,
            score,
            externalId: `reddit-${id}`,
            publishedAt: new Date(created_utc * 1000),
            extra: JSON.stringify({ num_comments, subreddit }),
          })
        }

        // 请求间隔，避免被限流
        await new Promise((r) => setTimeout(r, 500))
      } catch {
        // 单个子版块失败不影响其他
      }
    }

    // 按 score 降序排列，取前40条
    items.sort((a, b) => b.score - a.score)
    return items.slice(0, 40)
  }
}
