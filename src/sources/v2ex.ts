import { TrendSource, TrendData } from './base'

interface V2EXTopic {
  id: number
  title: string
  url: string
  content?: string
  content_rendered?: string
  replies: number
  node: {
    name: string
    title: string
  }
  member: {
    username: string
  }
  created: number
  last_modified: number
}

export class V2EXSource implements TrendSource {
  name = 'v2ex'

  async fetch(): Promise<TrendData[]> {
    const response = await fetch('https://www.v2ex.com/api/topics/hot.json', {
      headers: {
        'User-Agent': 'TrendTracker/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`V2EX API failed: ${response.status}`)
    }

    const topics = await response.json() as V2EXTopic[]
    const items: TrendData[] = []

    for (const topic of topics) {
      if (!topic.title) continue

      items.push({
        title: topic.title,
        url: `https://www.v2ex.com/t/${topic.id}`,
        source: this.name,
        score: topic.replies || 0,
        externalId: `v2ex-${topic.id}`,
        publishedAt: topic.created ? new Date(topic.created * 1000) : undefined,
        extra: JSON.stringify({
          replies: topic.replies,
          node: topic.node?.title || topic.node?.name,
          author: topic.member?.username,
        }),
      })
    }

    return items
  }
}
