import prisma from '../db'

/**
 * Detect language of a text string using Unicode range heuristics.
 * Returns ISO 639-1 code: 'zh', 'ja', 'ko', 'en', etc.
 * Zero API cost — pure character analysis.
 */
export function detectLanguage(text: string): string {
  if (!text) return 'en'

  let cjkCount = 0
  let hiraganaKatakana = 0
  let hangul = 0
  let latin = 0
  let totalAlphaNum = 0

  for (const char of text) {
    const code = char.codePointAt(0)!
    // CJK Unified Ideographs
    if (code >= 0x4e00 && code <= 0x9fff) {
      cjkCount++
      totalAlphaNum++
    }
    // Hiragana
    else if (code >= 0x3040 && code <= 0x309f) {
      hiraganaKatakana++
      totalAlphaNum++
    }
    // Katakana
    else if (code >= 0x30a0 && code <= 0x30ff) {
      hiraganaKatakana++
      totalAlphaNum++
    }
    // Hangul Syllables
    else if (code >= 0xac00 && code <= 0xd7af) {
      hangul++
      totalAlphaNum++
    }
    // Hangul Jamo
    else if (code >= 0x1100 && code <= 0x11ff) {
      hangul++
      totalAlphaNum++
    }
    // Latin letters
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      latin++
      totalAlphaNum++
    }
    // Digits
    else if (code >= 0x30 && code <= 0x39) {
      totalAlphaNum++
    }
  }

  if (totalAlphaNum === 0) return 'en'

  // Japanese: has hiragana/katakana (even mixed with CJK)
  if (hiraganaKatakana > 0 && hiraganaKatakana / totalAlphaNum > 0.05) return 'ja'

  // Korean: has hangul
  if (hangul > 0 && hangul / totalAlphaNum > 0.1) return 'ko'

  // Chinese: CJK dominant (not Japanese/Korean)
  if (cjkCount > 0 && cjkCount / totalAlphaNum > 0.15) return 'zh'

  return 'en'
}

/** Human-readable language labels */
export const LANG_LABELS: Record<string, string> = {
  zh: '中',
  en: 'EN',
  ja: '日',
  ko: '한',
}

const BATCH_SIZE = 50

export class TranslatorService {
  private apiKey: string | null = null
  private model: string

  constructor() {
    const key = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
    if (key && key !== 'your_openrouter_api_key_here') {
      this.apiKey = key
    }
  }

  get isConfigured(): boolean {
    return this.apiKey !== null
  }

  /**
   * Batch translate titles. Returns a Map from item index to translated string.
   * Only translates items whose language differs from targetLang.
   */
  async translateBatch(
    items: { index: number; title: string; language: string }[],
    targetLang: 'zh' | 'en',
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>()
    if (!this.apiKey || items.length === 0) return result

    // Filter items that actually need translation
    const needTranslation = items.filter(item => {
      if (targetLang === 'zh' && item.language === 'zh') return false
      if (targetLang === 'en' && item.language === 'en') return false
      return true
    })

    if (needTranslation.length === 0) return result

    const targetLabel = targetLang === 'zh' ? '中文' : 'English'

    for (let i = 0; i < needTranslation.length; i += BATCH_SIZE) {
      const batch = needTranslation.slice(i, i + BATCH_SIZE)
      const numbered = batch.map((item, idx) => `${idx + 1}. ${item.title}`).join('\n')

      const prompt = `Translate each title below to ${targetLabel}. Keep technical terms, brand names, and proper nouns in their original form when appropriate.

Return ONLY a JSON array of strings, where each element is the translation of the corresponding title. Example: ["翻译1", "翻译2", ...]

Do NOT include any explanation or markdown formatting, only the JSON array.

Titles:
${numbered}`

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': 'TrendTracker-Translator',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          }),
        })

        if (!response.ok) {
          console.error(`[Translator] API error ${response.status}`)
          continue
        }

        const completion: any = await response.json()
        const content = completion.choices?.[0]?.message?.content
        if (!content) continue

        const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
        const translations: string[] = JSON.parse(jsonStr)

        batch.forEach((item, idx) => {
          if (translations[idx] && typeof translations[idx] === 'string') {
            result.set(item.index, translations[idx])
          }
        })

        console.log(`[Translator] Translated batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items) to ${targetLabel}`)
      } catch (err: any) {
        console.error(`[Translator] Batch translation failed:`, err?.message || err)
      }
    }

    return result
  }

  /**
   * Detect language and translate a list of items.
   * Returns arrays of {language, titleZh, titleEn} aligned with input.
   */
  async detectAndTranslate(
    items: { title: string; extra?: string }[],
  ): Promise<{ language: string; titleZh: string | null; titleEn: string | null }[]> {
    const results: { language: string; titleZh: string | null; titleEn: string | null }[] = []

    // Step 1: Detect language for all items
    const withLang = items.map((item, index) => {
      let desc = ''
      try {
        const parsed = JSON.parse(item.extra || '{}')
        desc = parsed.description || parsed.snippet || parsed.text || ''
      } catch { /* ignore */ }

      const language = detectLanguage(item.title + ' ' + desc)
      results.push({ language, titleZh: null, titleEn: null })
      return { index, title: item.title, language }
    })

    if (!this.apiKey) {
      console.warn('[Translator] OpenRouter API key not configured, skipping translation')
      return results
    }

    // Step 2: Batch translate to Chinese (for non-zh items)
    const needZh = withLang.filter(i => i.language !== 'zh')
    if (needZh.length > 0) {
      const zhMap = await this.translateBatch(needZh, 'zh')
      for (const [idx, translation] of zhMap) {
        results[idx].titleZh = translation
      }
    }

    // Step 3: Batch translate to English (for non-en items)
    const needEn = withLang.filter(i => i.language !== 'en')
    if (needEn.length > 0) {
      const enMap = await this.translateBatch(needEn, 'en')
      for (const [idx, translation] of enMap) {
        results[idx].titleEn = translation
      }
    }

    const zhCount = needZh.length
    const enCount = needEn.length
    console.log(`[Translator] Processed ${items.length} items: ${zhCount} translated to zh, ${enCount} translated to en`)
    return results
  }

  /**
   * Generate one-line summaries for items (on-demand, cached in DB).
   * Returns map from item ID to summary string.
   */
  async generateSummaries(itemIds: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>()
    if (!this.apiKey || itemIds.length === 0) return result

    // Fetch items that don't have summaries yet
    const items = await prisma.trendItem.findMany({
      where: { id: { in: itemIds }, summary: null },
      select: { id: true, title: true, titleZh: true, source: true, extra: true },
    })

    if (items.length === 0) return result

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const numbered = batch.map((item, idx) => {
        let extraInfo = ''
        try {
          const parsed = JSON.parse(item.extra || '{}')
          if (parsed.description) extraInfo = ` — ${parsed.description.slice(0, 100)}`
          else if (parsed.snippet) extraInfo = ` — ${parsed.snippet.slice(0, 100)}`
        } catch { /* ignore */ }
        const title = item.titleZh || item.title
        return `${idx + 1}. [${item.source}] ${title}${extraInfo}`
      }).join('\n')

      const prompt = `为以下每条热点生成一句中文摘要（每条不超过30个字），帮助读者快速判断这条信息的价值和核心内容。

返回一个 JSON 字符串数组，每个元素对应一条摘要。格式: ["摘要1", "摘要2", ...]
只返回 JSON 数组，不要其他内容。

热点列表：
${numbered}`

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': 'TrendTracker-Summary',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        })

        if (!response.ok) {
          console.error(`[Translator] Summary API error ${response.status}`)
          continue
        }

        const completion: any = await response.json()
        const content = completion.choices?.[0]?.message?.content
        if (!content) continue

        const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
        const summaries: string[] = JSON.parse(jsonStr)

        for (let j = 0; j < batch.length; j++) {
          const summary = summaries[j]
          if (summary && typeof summary === 'string') {
            await prisma.trendItem.update({
              where: { id: batch[j].id },
              data: { summary },
            })
            result.set(batch[j].id, summary)
          }
        }

        console.log(`[Translator] Generated ${batch.length} summaries`)
      } catch (err: any) {
        console.error(`[Translator] Summary generation failed:`, err?.message || err)
      }
    }

    return result
  }

  /**
   * Backfill translations for existing items that lack language/translation data.
   */
  async backfill(batchSize = 200): Promise<{ total: number; translated: number }> {
    let total = 0
    let translated = 0
    let skip = 0

    while (true) {
      const items = await prisma.trendItem.findMany({
        where: { language: null },
        select: { id: true, title: true, extra: true },
        take: batchSize,
        skip,
        orderBy: { id: 'asc' },
      })

      if (items.length === 0) break

      const translationResults = await this.detectAndTranslate(
        items.map(i => ({ title: i.title, extra: i.extra || undefined })),
      )

      for (let i = 0; i < items.length; i++) {
        const tr = translationResults[i]
        await prisma.trendItem.update({
          where: { id: items[i].id },
          data: {
            language: tr.language,
            titleZh: tr.titleZh,
            titleEn: tr.titleEn,
          },
        })
        if (tr.titleZh || tr.titleEn) translated++
      }

      total += items.length
      console.log(`[Translator] Backfill progress: ${total} processed, ${translated} translated`)

      // Items with language=null are now updated, so no need to advance skip
      // Just re-query from 0
    }

    console.log(`[Translator] Backfill complete: ${total} total, ${translated} translated`)
    return { total, translated }
  }
}
