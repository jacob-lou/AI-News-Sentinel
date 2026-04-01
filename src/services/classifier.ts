import prisma from '../db'

// ── Phase A: keyword-based classification ──────────────────────────
const AI_KEYWORDS: string[] = [
  // Models & architectures
  'GPT', 'ChatGPT', 'GPT-4', 'GPT-5', 'Claude', 'Gemini', 'LLaMA', 'Llama',
  'Mistral', 'Mixtral', 'Phi-3', 'Phi-4', 'Qwen', 'DeepSeek', 'Yi-',
  'DALL-E', 'Midjourney', 'Stable Diffusion', 'SDXL', 'Sora', 'Whisper',
  'Codex', 'Copilot', 'Cursor', 'Devin',
  // Core concepts
  'LLM', 'Large Language Model', 'Transformer', 'Diffusion Model',
  'Foundation Model', 'Multimodal', 'Vision Language', 'VLM',
  'Embedding', 'Fine-tuning', 'Fine-tune', 'RLHF', 'DPO', 'LoRA', 'QLoRA',
  'RAG', 'Retrieval Augmented', 'Prompt Engineering', 'Chain of Thought',
  'CoT', 'In-context Learning', 'Few-shot', 'Zero-shot',
  'Token', 'Tokenizer', 'Context Window', 'Attention Mechanism',
  'Neural Network', 'Deep Learning', 'Machine Learning',
  'Reinforcement Learning', 'Computer Vision',
  'Natural Language Processing', 'NLP', 'NLU', 'NLG',
  'Generative AI', 'GenAI', 'AGI', 'Artificial General Intelligence',
  'AI Safety', 'AI Alignment', 'AI Ethics', 'AI Regulation',
  'AI Agent', 'AI Coding', 'AI Assistant',
  // Frameworks & tools
  'PyTorch', 'TensorFlow', 'JAX', 'Hugging Face', 'HuggingFace',
  'LangChain', 'LlamaIndex', 'vLLM', 'Ollama', 'GGUF', 'GGML',
  'OpenAI', 'Anthropic', 'Google AI', 'Meta AI', 'xAI', 'Grok',
  'Cohere', 'Stability AI', 'Perplexity',
  'MLOps', 'ML Pipeline', 'Model Serving', 'Model Deployment',
  'CUDA', 'TensorRT', 'ONNX', 'Triton',
  // Benchmarks & eval
  'MMLU', 'HumanEval', 'GSM8K', 'HellaSwag', 'ARC-Challenge',
  'Chatbot Arena', 'LMSys', 'Open LLM Leaderboard',
  // Chinese AI terms
  '大模型', '大语言模型', '人工智能', '机器学习', '深度学习',
  '自然语言处理', '计算机视觉', '生成式AI', '智能体',
  '微调', '预训练', '推理优化', '量化', '蒸馏',
  '提示词', '提示工程', 'AI编程', 'AI代码', 'AI绘画', 'AI视频',
  '文心一言', '通义千问', '智谱', 'ChatGLM', '讯飞星火', '豆包',
  '百川', 'Kimi', 'MiniMax', '月之暗面',
]

// Compile patterns: word-boundary for ASCII, plain contains for CJK
const AI_PATTERNS: { test: (text: string) => boolean }[] = AI_KEYWORDS.map(kw => {
  const hasCJK = /[\u4e00-\u9fff]/.test(kw)
  if (hasCJK) {
    // Chinese keywords: simple contains (case-insensitive)
    const lower = kw.toLowerCase()
    return { test: (text: string) => text.toLowerCase().includes(lower) }
  } else {
    // English keywords: word-boundary match (case-insensitive)
    try {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      return { test: (text: string) => re.test(text) }
    } catch {
      const lower = kw.toLowerCase()
      return { test: (text: string) => text.toLowerCase().includes(lower) }
    }
  }
})

function classifyByKeyword(title: string, description: string): 'ai' | null {
  const text = `${title} ${description}`
  for (const pattern of AI_PATTERNS) {
    if (pattern.test(text)) return 'ai'
  }
  return null
}

// ── Phase B: AI-based classification via OpenRouter ────────────────
const BATCH_SIZE = 50

async function classifyByAI(
  items: { index: number; title: string; description: string }[],
  apiKey: string,
  model: string,
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  if (items.length === 0) return result

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const numbered = batch.map((item, idx) => `${idx + 1}. ${item.title}`).join('\n')

    const prompt = `你是一个内容分类专家。请判断以下每条标题是否属于 "AI/人工智能/机器学习/深度学习" 相关领域。

规则：
- 如果标题涉及 AI模型、机器学习框架、大语言模型、AI产品、AI公司(OpenAI/Anthropic/Google AI等)、深度学习技术、AI应用、AI编程工具等，分类为 "ai"
- 否则分类为 "general"

请返回一个 JSON 数组，每个元素对应一条标题的分类结果，格式如：
["ai", "general", "ai", ...]

只返回 JSON 数组，不要其他任何内容。

标题列表：
${numbered}`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-Title': 'TrendTracker-Classifier',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        }),
      })

      if (!response.ok) {
        console.error(`[Classifier] AI API error ${response.status}`)
        continue
      }

      const completion: any = await response.json()
      const content = completion.choices?.[0]?.message?.content
      if (!content) continue

      const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      const categories: string[] = JSON.parse(jsonStr)

      batch.forEach((item, idx) => {
        const cat = categories[idx]
        if (cat === 'ai' || cat === 'general') {
          result.set(item.index, cat)
        }
      })

      console.log(`[Classifier] AI classified batch ${i / BATCH_SIZE + 1}: ${batch.length} items`)
    } catch (err: any) {
      console.error(`[Classifier] AI batch failed:`, err?.message || err)
    }
  }

  return result
}

// ── Public API ─────────────────────────────────────────────────────

export interface ClassifiedItem {
  index: number
  category: string
}

export class ClassifierService {
  private apiKey: string | null = null
  private model: string
  private dbRules: { keyword: string; category: string; isRegex: boolean }[] | null = null

  constructor() {
    const key = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
    if (key && key !== 'your_openrouter_api_key_here') {
      this.apiKey = key
    }
  }

  private async loadDbRules() {
    if (this.dbRules !== null) return
    try {
      const rules = await prisma.categoryRule.findMany({ where: { active: true } })
      this.dbRules = rules.map(r => ({
        keyword: r.keyword,
        category: r.category,
        isRegex: r.isRegex,
      }))
    } catch {
      this.dbRules = []
    }
  }

  private classifyByDbRules(title: string, description: string): string | null {
    if (!this.dbRules || this.dbRules.length === 0) return null
    const text = `${title} ${description}`
    for (const rule of this.dbRules) {
      if (rule.isRegex) {
        try {
          if (new RegExp(rule.keyword, 'i').test(text)) return rule.category
        } catch { /* skip bad regex */ }
      } else {
        if (text.toLowerCase().includes(rule.keyword.toLowerCase())) return rule.category
      }
    }
    return null
  }

  /**
   * Classify an array of trend items. Returns category for each item.
   * Phase A: keyword matching (instant, no API cost)
   * Phase B: AI fallback for unmatched items (if API key configured)
   */
  async classify(
    items: { title: string; extra?: string }[],
  ): Promise<string[]> {
    await this.loadDbRules()

    const categories: (string | null)[] = new Array(items.length).fill(null)
    const needAI: { index: number; title: string; description: string }[] = []

    // Phase A: keyword + DB rules
    for (let i = 0; i < items.length; i++) {
      const { title, extra } = items[i]
      let desc = ''
      try {
        const parsed = JSON.parse(extra || '{}')
        desc = parsed.description || parsed.snippet || parsed.text || ''
      } catch { /* ignore */ }

      // 1) DB rules first (user-defined)
      const dbResult = this.classifyByDbRules(title, desc)
      if (dbResult) {
        categories[i] = dbResult
        continue
      }

      // 2) Built-in keyword matching
      const kwResult = classifyByKeyword(title, desc)
      if (kwResult) {
        categories[i] = kwResult
        continue
      }

      // 3) Needs AI classification
      needAI.push({ index: i, title, description: desc })
    }

    // Phase B: AI classification for remaining items
    if (needAI.length > 0 && this.apiKey) {
      console.log(`[Classifier] ${items.length - needAI.length} classified by keywords, ${needAI.length} need AI`)
      const aiResults = await classifyByAI(needAI, this.apiKey, this.model)
      for (const [idx, cat] of aiResults) {
        categories[idx] = cat
      }
    }

    // Default unclassified items to "general"
    return categories.map(c => c || 'general')
  }

  /**
   * Backfill categories for existing items that have category="general" (default).
   * Processes in batches to avoid memory issues.
   */
  async backfill(batchSize = 200): Promise<{ total: number; aiCount: number }> {
    let total = 0
    let aiCount = 0
    let skip = 0

    while (true) {
      const items = await prisma.trendItem.findMany({
        where: { category: 'general' },
        select: { id: true, title: true, extra: true },
        take: batchSize,
        skip,
        orderBy: { id: 'asc' },
      })

      if (items.length === 0) break

      const categories = await this.classify(
        items.map(i => ({ title: i.title, extra: i.extra || undefined })),
      )

      // Batch update items whose category changed from general → ai
      for (let i = 0; i < items.length; i++) {
        if (categories[i] === 'ai') {
          await prisma.trendItem.update({
            where: { id: items[i].id },
            data: { category: 'ai' },
          })
          aiCount++
        }
      }

      total += items.length
      console.log(`[Classifier] Backfill progress: ${total} processed, ${aiCount} classified as AI`)

      // If no items were reclassified in this batch, advance skip
      // Otherwise re-query from 0 since some items moved out of "general"
      if (categories.every(c => c === 'general')) {
        skip += batchSize
      } else {
        skip = 0 // re-query since filtered set changed
      }
    }

    console.log(`[Classifier] Backfill complete: ${total} total, ${aiCount} classified as AI`)
    return { total, aiCount }
  }
}
