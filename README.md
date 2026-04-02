# 🔥 AI News Sentinel

**实时多源热点聚合系统** — 从 10 个全球平台采集热门话题，AI 智能分类 + 翻译 + 重要度排序，30 分钟自动刷新。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)

---

## ✨ 功能特性

- **10 个数据源**：Google Trends、Reddit、HackerNews、GitHub Trending、HuggingFace、Twitter/X、DuckDuckGo、Bing News、V2EX、Bilibili
- **AI 智能分析**：基于 OpenRouter 的自动分类、多语言翻译、趋势总结
- **实时推送**：WebSocket 驱动，新热点即时推送至前端
- **关键词监控**：设置关注词，自动追踪并告警
- **重要度排序**：四因子评估（热度 × 互动 × 跨源 × 时效）
- **全站 i18n**：中英文界面切换，标题自动翻译
- **Agent Skill**：开箱即用的 AI Agent 技能包，让 Copilot/Claude 直接调用采集能力

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (SPA)                         │
│            HTML/CSS/JS + Socket.IO Client                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket
┌──────────────────────┴──────────────────────────────────┐
│                  Express 5 Server                        │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │
│  │ REST API   │  │ Socket.IO  │  │ Cron Scheduler │    │
│  │ (17 端点)  │  │ (实时推送)  │  │ (定时采集)     │    │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘    │
│        └───────────────┼──────────────────┘              │
│                        │                                 │
│  ┌─────────────────────┴───────────────────────────────┐│
│  │           Services Layer                             ││
│  │  Collector → Classifier → Translator → Importance   ││
│  │                    → Analysis → Monitor              ││
│  └─────────────────────┬───────────────────────────────┘│
│                        │                                 │
│  ┌─────────────────────┴───────────────────────────────┐│
│  │           Source Collector Layer (10 源)              ││
│  │  Google │ Reddit │ HN │ GitHub │ HuggingFace        ││
│  │  DDG │ Bing │ V2EX │ Bilibili │ Twitter/X           ││
│  └─────────────────────┬───────────────────────────────┘│
│                        │                                 │
│  ┌─────────────────────┴───────────────────────────────┐│
│  │              Prisma ORM + SQLite                     ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- npm / pnpm

### 安装

```bash
git clone https://github.com/jacob-lou/AI-News-Sentinel.git
cd AI-News-Sentinel
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 必需 — OpenRouter API（用于 AI 分类/翻译/分析）
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# 可选 — Twitter/X 数据源
TWITTER_API_KEY=your-twitter-api-key

# 可选 — 服务端口（默认 3000）
PORT=3000
```

> **注意**：没有 `TWITTER_API_KEY` 时，Twitter 源会自动跳过，其他 9 个源正常工作。

### 初始化数据库

```bash
npx prisma db push
```

### 启动

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

访问 `http://localhost:3000` 即可看到热点面板。

## 📊 数据源一览

| 数据源 | 采集方式 | 数据内容 | 需要 API Key |
|--------|---------|---------|:---:|
| Google Trends | RSS Feed | 热搜关键词 + 热度值 | ❌ |
| Reddit | JSON API | 11 个 AI subreddit 热帖 | ❌ |
| HackerNews | Algolia API | 热门技术故事 | ❌ |
| GitHub Trending | HTML 解析 | 当日热门仓库 | ❌ |
| HuggingFace | REST API | 热门模型 + 论文 | ❌ |
| DuckDuckGo | 补全 + 即时答案 | 搜索趋势 | ❌ |
| Bing News | RSS Feed | 科技新闻 | ❌ |
| V2EX | REST API | 中文技术社区热帖 | ❌ |
| Bilibili | Web API | 热搜 + 科技区热门视频 | ❌ |
| Twitter/X | twitterapi.io | AI 热门推文 | ✅ |

## 🤖 Agent Skill（AI 助手技能包）

系统附带一个独立的 **Agent Skill**，可让 GitHub Copilot、Claude 等 AI 助手直接使用热点采集能力。

### 核心理念：AI Agent = 分析引擎

```
用户提问 → Agent 执行脚本抓取原始数据 → Agent 自身分析/分类/翻译 → Agent 输出报告
```

脚本只负责纯 HTTP 数据抓取，**零 AI API 调用**。所有智能分析由 Agent 自身完成。

### 使用方式

```bash
# 采集全部数据源的热点
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts

# 指定数据源 + 数量限制
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts --sources hackernews,reddit --limit 10

# 跨源关键词搜索
npx tsx skills/hot-topics-monitor/scripts/search-keyword.ts "GPT-5"
npx tsx skills/hot-topics-monitor/scripts/search-keyword.ts "DeepSeek" --sources reddit,hackernews
```

**Skill 位置**：`skills/hot-topics-monitor/SKILL.md`

> 详见 [Skill 文档](skills/hot-topics-monitor/SKILL.md) 了解完整的分析框架和工作流。

## 📁 项目结构

```
.
├── src/
│   ├── index.ts              # 入口文件
│   ├── app.ts                # Express 应用配置
│   ├── db.ts                 # Prisma 客户端
│   ├── socket.ts             # Socket.IO 配置
│   ├── scheduler.ts          # 定时任务（30min 全源 + 10min 关键词）
│   ├── routes/
│   │   ├── trends.ts         # 热点 API（CRUD + 分析 + 采集）
│   │   └── keywords.ts       # 关键词监控 API
│   ├── services/
│   │   ├── collector.ts      # 采集调度服务
│   │   ├── classifier.ts     # AI 分类服务
│   │   ├── translator.ts     # 多语言翻译服务
│   │   ├── importance.ts     # 重要度评估
│   │   ├── analysis.ts       # AI 趋势分析
│   │   ├── monitor.ts        # 关键词监控服务
│   │   └── keyword-search.ts # 关键词搜索服务
│   └── sources/              # 10 个数据源采集器
│       ├── base.ts
│       ├── google.ts
│       ├── reddit.ts
│       ├── hackernews.ts
│       ├── github.ts
│       ├── huggingface.ts
│       ├── duckduckgo.ts
│       ├── bingnews.ts
│       ├── v2ex.ts
│       ├── bilibili.ts
│       └── twitter.ts
├── public/                   # 前端静态文件
│   ├── index.html
│   ├── style.css
│   └── app.js
├── prisma/
│   └── schema.prisma         # 数据库模型（7 张表）
├── skills/                   # Agent Skill（独立技能包）
│   └── hot-topics-monitor/
│       ├── SKILL.md
│       ├── scripts/
│       └── references/
└── docs/                     # 项目文档
    ├── 需求文档.md
    ├── 技术方案.md
    └── 方案日志.md
```

## 🗄️ 数据模型

| 模型 | 用途 |
|------|------|
| `TrendItem` | 热点记录（标题、来源、评分、分类、翻译、重要度） |
| `CategoryRule` | 分类规则（关键词 → 分类映射） |
| `FetchLog` | 采集日志（来源、状态、耗时） |
| `TrendAnalysis` | AI 分析报告缓存 |
| `MonitorKeyword` | 关键词监控配置 |
| `KeywordAlert` | 关键词告警记录 |
| `KeywordTrend` | 关键词趋势数据 |

## 🔌 API 端点

### 热点相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/trends` | 获取热点列表（支持分页、来源筛选、分类筛选） |
| `GET` | `/api/trends/sources` | 获取可用数据源列表 |
| `GET` | `/api/trends/categories` | 获取分类列表及计数 |
| `GET` | `/api/trends/analysis` | 获取 AI 趋势分析报告 |
| `POST` | `/api/trends/fetch` | 手动触发全源采集 |
| `POST` | `/api/trends/analyze` | 触发 AI 分析 |

### 关键词监控

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/keywords` | 获取监控关键词列表 |
| `POST` | `/api/keywords` | 添加监控关键词 |
| `DELETE` | `/api/keywords/:id` | 删除关键词 |
| `GET` | `/api/keywords/:id/alerts` | 获取关键词告警列表 |
| `GET` | `/api/keywords/:id/trends` | 获取关键词趋势 |

### WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `newTrends` | Server → Client | 新热点推送 |
| `fetchStatus` | Server → Client | 采集进度 |
| `keywordAlert` | Server → Client | 关键词命中告警 |

## 🧪 测试

```bash
npm test
```

## 📜 版本历史

| 版本 | 主要变更 |
|------|---------|
| **V1.5** | Agent Skill — 热点监控工具封装为独立 AI 技能包 |
| **V1.4** | 多语言翻译 + 信息增强 + 全站 i18n |
| **V1.3** | AI 分类 + 重要度排序 + 关键词监控 |
| **V1.2** | 新增 5 个数据源（GitHub, HF, V2EX, Bing, Bilibili） |
| **V1.1** | AI 趋势分析 + 跨源搜索 |
| **V1.0** | 基础版 — 5 源采集 + 实时推送 + 前端面板 |

> 完整变更记录见 [docs/方案日志.md](docs/方案日志.md)

## 📄 License

[MIT](LICENSE) © jacob lou
