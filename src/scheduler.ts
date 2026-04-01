import { CronJob } from 'cron'
import { CollectorService } from './services/collector'
import { AnalysisService } from './services/analysis'
import { MonitorService } from './services/monitor'
import { ImportanceService } from './services/importance'
import { getIO } from './socket'

let job: CronJob | null = null
let monitorJob: CronJob | null = null
let keywordTrendJob: CronJob | null = null

export function startScheduler() {
  const collector = new CollectorService()
  const analysis = new AnalysisService()
  const monitor = new MonitorService()
  const importance = new ImportanceService()

  // Run every 30 minutes: at minute 0 and 30 of every hour
  job = CronJob.from({
    cronTime: '0 */30 * * * *',
    onTick: async () => {
      console.log(`[Scheduler] Starting collection at ${new Date().toISOString()}`)
      try {
        const results = await collector.collectAll()
        const io = getIO()

        const totalItems = results.reduce((sum, r) => sum + r.items.length, 0)
        console.log(`[Scheduler] Collection complete: ${totalItems} items from ${results.length} sources`)

        if (io) {
          const allItems = results.flatMap((r) => r.items)
          if (allItems.length > 0) {
            io.emit('new-trends', {
              items: allItems,
              timestamp: new Date().toISOString(),
            })
          }
          io.emit('fetch-status', {
            results: results.map((r) => ({
              source: r.source,
              count: r.items.length,
              error: r.error,
            })),
            timestamp: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[Scheduler] Collection failed:', err)
      }

      // Compute importance scores after collection
      try {
        console.log('[Scheduler] Computing importance scores...')
        await importance.computeScores()
      } catch (err) {
        console.error('[Scheduler] Importance scoring failed:', err)
      }

      // Run AI analysis after collection (for both categories)
      if (analysis.isConfigured) {
        try {
          console.log('[Scheduler] Running AI analysis...')
          const aiResult = await analysis.analyzeTrends({ category: 'ai' })
          const generalResult = await analysis.analyzeTrends({ category: 'general' })
          const aio = getIO()
          if (aio) {
            if (aiResult) {
              aio.emit('analysis-update', { analysis: aiResult, category: 'ai', timestamp: new Date().toISOString() })
            }
            if (generalResult) {
              aio.emit('analysis-update', { analysis: generalResult, category: 'general', timestamp: new Date().toISOString() })
            }
          }
        } catch (err) {
          console.error('[Scheduler] AI analysis failed:', err)
        }
      }
    },
    start: true,
    runOnInit: true, // Run immediately on startup
  })

  // Keyword monitoring: check every 10 minutes
  monitorJob = CronJob.from({
    cronTime: '0 */10 * * * *',
    onTick: async () => {
      console.log(`[Scheduler] Running keyword monitoring check...`)
      try {
        await monitor.checkAllKeywords()
      } catch (err) {
        console.error('[Scheduler] Keyword monitoring failed:', err)
      }
    },
    start: true,
    runOnInit: false, // Don't run on startup to avoid overlap with main collection
  })

  // Keyword-scoped trend collection: every 30 minutes, offset by 15min from main
  keywordTrendJob = CronJob.from({
    cronTime: '0 15,45 * * * *',
    onTick: async () => {
      console.log(`[Scheduler] Collecting keyword-scoped trends...`)
      try {
        await monitor.collectKeywordTrends()
      } catch (err) {
        console.error('[Scheduler] Keyword trend collection failed:', err)
      }
    },
    start: true,
    runOnInit: false,
  })

  console.log('[Scheduler] Started - main collection every 30min, keyword monitor every 10min, keyword trends at :15/:45')
}

export function stopScheduler() {
  if (job) { job.stop(); job = null }
  if (monitorJob) { monitorJob.stop(); monitorJob = null }
  if (keywordTrendJob) { keywordTrendJob.stop(); keywordTrendJob = null }
  console.log('[Scheduler] Stopped')
}
