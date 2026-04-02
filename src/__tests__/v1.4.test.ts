import { describe, it, expect } from 'vitest'

// Import detectLanguage directly
// We need to test the language detection and translation helpers
const { detectLanguage, LANG_LABELS } = await import('../services/translator')

describe('V1.4 — Translation & Information Enhancement', () => {
  // === Language Detection Tests ===
  describe('detectLanguage', () => {
    it('should detect English text', () => {
      expect(detectLanguage('OpenAI releases GPT-5 with breakthrough capabilities')).toBe('en')
      expect(detectLanguage('GitHub trending repositories for today')).toBe('en')
      expect(detectLanguage('How to build a RAG pipeline in Python')).toBe('en')
    })

    it('should detect Chinese text', () => {
      expect(detectLanguage('人工智能技术突破性进展')).toBe('zh')
      expect(detectLanguage('百度发布新一代大模型')).toBe('zh')
      expect(detectLanguage('热搜排行榜更新')).toBe('zh')
    })

    it('should detect Japanese text', () => {
      expect(detectLanguage('東京で開催されるAI会議')).toBe('ja')
      expect(detectLanguage('プログラミング言語の人気ランキング')).toBe('ja')
      expect(detectLanguage('これは日本語のテストです')).toBe('ja')
    })

    it('should detect Korean text', () => {
      expect(detectLanguage('인공지능 기술이 발전하고 있습니다')).toBe('ko')
      expect(detectLanguage('한국어 테스트 문장입니다')).toBe('ko')
    })

    it('should handle mixed CJK/English text', () => {
      // Chinese with English terms — should be zh because CJK dominant
      expect(detectLanguage('DeepSeek发布新模型V3')).toBe('zh')
      expect(detectLanguage('OpenAI的GPT-5来了')).toBe('zh')
    })

    it('should handle Japanese with kanji (distinguish from Chinese)', () => {
      // Text with hiragana → Japanese
      expect(detectLanguage('これはテスト')).toBe('ja')
      // Text with katakana → Japanese
      expect(detectLanguage('プログラム')).toBe('ja')
    })

    it('should default to English for empty/numeric text', () => {
      expect(detectLanguage('')).toBe('en')
      expect(detectLanguage('12345')).toBe('en')
      expect(detectLanguage('   ')).toBe('en')
    })

    it('should handle text with numbers and special chars', () => {
      expect(detectLanguage('GPT-4o costs $20/month for API access')).toBe('en')
      expect(detectLanguage('B站热搜第1名：AI视频生成')).toBe('zh')
    })
  })

  // === Language Labels ===
  describe('LANG_LABELS', () => {
    it('should have labels for main languages', () => {
      expect(LANG_LABELS.zh).toBe('中')
      expect(LANG_LABELS.en).toBe('EN')
      expect(LANG_LABELS.ja).toBe('日')
      expect(LANG_LABELS.ko).toBe('한')
    })
  })

  // === Cross-source Count Display Logic ===
  describe('crossSourceCount display logic', () => {
    function formatCrossBadge(count: number): string | null {
      if (count < 2) return null
      if (count >= 4) return '4+源热议'
      return count + '源热议'
    }

    it('should not show badge for 0 or 1 cross-source', () => {
      expect(formatCrossBadge(0)).toBeNull()
      expect(formatCrossBadge(1)).toBeNull()
    })

    it('should show "2源热议" for 2', () => {
      expect(formatCrossBadge(2)).toBe('2源热议')
    })

    it('should show "3源热议" for 3', () => {
      expect(formatCrossBadge(3)).toBe('3源热议')
    })

    it('should show "4+源热议" for 4 or more', () => {
      expect(formatCrossBadge(4)).toBe('4+源热议')
      expect(formatCrossBadge(8)).toBe('4+源热议')
    })
  })

  // === Display Title Logic ===
  describe('getDisplayTitle logic', () => {
    function getDisplayTitle(item: any, lang: string): string {
      if (lang === 'zh') {
        if (item.language === 'zh') return item.title
        return item.titleZh || item.title
      } else if (lang === 'en') {
        if (item.language === 'en') return item.title
        return item.titleEn || item.title
      }
      return item.title
    }

    it('should return original title when language matches displayLang', () => {
      const item = { title: 'Hello world', language: 'en', titleZh: '你好世界', titleEn: null }
      expect(getDisplayTitle(item, 'en')).toBe('Hello world')
    })

    it('should return Chinese translation for English item when displayLang is zh', () => {
      const item = { title: 'AI breakthrough', language: 'en', titleZh: 'AI突破', titleEn: null }
      expect(getDisplayTitle(item, 'zh')).toBe('AI突破')
    })

    it('should return English translation for Chinese item when displayLang is en', () => {
      const item = { title: '人工智能突破', language: 'zh', titleZh: null, titleEn: 'AI Breakthrough' }
      expect(getDisplayTitle(item, 'en')).toBe('AI Breakthrough')
    })

    it('should fallback to original title when no translation available', () => {
      const item = { title: 'Texte en français', language: 'fr', titleZh: null, titleEn: null }
      expect(getDisplayTitle(item, 'zh')).toBe('Texte en français')
      expect(getDisplayTitle(item, 'en')).toBe('Texte en français')
    })

    it('should return original for Chinese title when displayLang is zh', () => {
      const item = { title: '热搜排行榜', language: 'zh', titleZh: null, titleEn: 'Hot Search Rankings' }
      expect(getDisplayTitle(item, 'zh')).toBe('热搜排行榜')
    })
  })
})
