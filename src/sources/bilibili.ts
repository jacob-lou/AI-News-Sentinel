import { TrendSource, TrendData } from './base'

export class BilibiliSource implements TrendSource {
  name = 'bilibili'

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []

    // 1. B站热搜
    await this.fetchHotSearch(items)
    // 2. B站科技区排行榜
    await this.fetchTechRanking(items)

    return items
  }

  /** 热搜榜 */
  private async fetchHotSearch(items: TrendData[]): Promise<void> {
    try {
      const resp = await fetch('https://app.bilibili.com/x/v2/search/trending/ranking', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      })
      if (!resp.ok) return
      const json = (await resp.json()) as any
      const list = json?.data?.list
      if (!Array.isArray(list)) return

      for (const item of list) {
        const keyword = item.keyword || item.show_name
        if (!keyword) continue
        items.push({
          title: item.show_name || keyword,
          url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
          source: this.name,
          score: item.position ? (100 - item.position) * 100 : 0,
          externalId: `bili-hot-${keyword}`,
          extra: JSON.stringify({
            type: 'hot_search',
            position: item.position,
            icon: item.icon,
          }),
        })
      }
    } catch {
      // 热搜失败不影响其它
    }
  }

  /** 科技区排行榜 (rid=188) */
  private async fetchTechRanking(items: TrendData[]): Promise<void> {
    try {
      const resp = await fetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=188&type=all', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      })
      if (!resp.ok) return
      const json = (await resp.json()) as any
      const list = json?.data?.list
      if (!Array.isArray(list)) return

      // 取前 30 个
      for (const item of list.slice(0, 30)) {
        const title = item.title
        if (!title) continue
        const stat = item.stat || {}
        const bvid = item.bvid || ''

        items.push({
          title,
          url: bvid ? `https://www.bilibili.com/video/${bvid}` : undefined,
          source: this.name,
          score: stat.view || 0,
          externalId: `bili-tech-${bvid || title}`,
          publishedAt: item.pubdate ? new Date(item.pubdate * 1000) : undefined,
          extra: JSON.stringify({
            type: 'tech_video',
            views: stat.view,
            likes: stat.like,
            coins: stat.coin,
            danmaku: stat.danmaku,
            author: item.owner?.name,
            duration: item.duration,
            pic: item.pic,
          }),
        })
      }
    } catch {
      // 科技区排行失败不影响其它
    }
  }
}
