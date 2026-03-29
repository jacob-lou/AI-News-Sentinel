export interface TrendData {
  title: string
  url?: string
  source: string
  score: number
  extra?: string
  externalId: string
  publishedAt?: Date
}

export interface SourceResult {
  source: string
  items: TrendData[]
  error?: string
}

export interface TrendSource {
  name: string
  fetch(): Promise<TrendData[]>
}
