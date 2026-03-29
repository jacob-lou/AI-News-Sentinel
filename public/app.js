(function () {
  'use strict';

  const socket = io();
  let currentSource = 'all';
  let currentPage = 1;
  const PAGE_SIZE = 50;
  let currentDetailKeywordId = null;
  let alertCount = 0;

  // Elements — Trends
  const trendsList = document.getElementById('trendsList');
  const sourceFilters = document.getElementById('sourceFilters');
  const refreshBtn = document.getElementById('refreshBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('status');
  const paginationEl = document.getElementById('pagination');
  const fetchStatusEl = document.getElementById('fetchStatus');
  const analysisPanel = document.getElementById('analysisPanel');
  const analysisSummary = document.getElementById('analysisSummary');
  const analysisTopics = document.getElementById('analysisTopics');
  const analysisTime = document.getElementById('analysisTime');

  // Elements — Tabs
  const tabBtns = document.querySelectorAll('.tab-item');
  const trendsTab = document.getElementById('trendsTab');
  const keywordsTab = document.getElementById('keywordsTab');

  // Elements — Keywords
  const keywordInput = document.getElementById('keywordInput');
  const scopeInput = document.getElementById('scopeInput');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const checkKeywordsBtn = document.getElementById('checkKeywordsBtn');
  const collectKeywordTrendsBtn = document.getElementById('collectKeywordTrendsBtn');
  const keywordListEl = document.getElementById('keywordList');
  const keywordDetail = document.getElementById('keywordDetail');
  const detailTitle = document.getElementById('detailTitle');
  const closeDetail = document.getElementById('closeDetail');
  const detailAlerts = document.getElementById('detailAlerts');
  const detailTrends = document.getElementById('detailTrends');
  const recentAlertsEl = document.getElementById('recentAlerts');

  // Elements — Alert banner
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  const alertDismiss = document.getElementById('alertDismiss');
  const alertCountEl = document.getElementById('alertCount');

  // === Tab switching ===
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.dataset.tab;
      trendsTab.style.display = tab === 'trends' ? '' : 'none';
      trendsTab.classList.toggle('active', tab === 'trends');
      keywordsTab.style.display = tab === 'keywords' ? '' : 'none';
      keywordsTab.classList.toggle('active', tab === 'keywords');
      if (tab === 'keywords') {
        loadKeywords();
        loadRecentAlerts();
      }
    });
  });

  // === Load data ===
  async function loadTrends() {
    var params = new URLSearchParams({
      page: String(currentPage),
      limit: String(PAGE_SIZE),
    });
    if (currentSource !== 'all') params.set('source', currentSource);

    trendsList.innerHTML = '<div class="skeleton-group">'
      + '<div class="skeleton-line w80"></div>'
      + '<div class="skeleton-line w60"></div>'
      + '<div class="skeleton-line w80"></div>'
      + '<div class="skeleton-line w40"></div>'
      + '<div class="skeleton-line w80"></div>'
      + '</div>';

    try {
      var res = await fetch('/api/trends?' + params.toString());
      var data = await res.json();
      renderTrends(data.items);
      renderPagination(data.pagination);
    } catch {
      trendsList.innerHTML = '<div class="empty-state">加载失败，请刷新重试</div>';
    }
  }

  async function loadSources() {
    try {
      var res = await fetch('/api/trends/sources');
      var data = await res.json();
      renderSourceFilters(data.sources);
    } catch {}
  }

  async function loadAnalysis() {
    try {
      var res = await fetch('/api/trends/analysis');
      var data = await res.json();
      if (data.analysis) renderAnalysis(data.analysis);
      if (!data.configured) analyzeBtn.style.display = 'none';
    } catch {}
  }

  // === Keywords CRUD ===
  async function loadKeywords() {
    try {
      var res = await fetch('/api/keywords');
      var data = await res.json();
      renderKeywordList(data.keywords);
    } catch {
      keywordListEl.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  async function loadRecentAlerts() {
    try {
      var res = await fetch('/api/keywords/alerts/recent');
      var data = await res.json();
      renderRecentAlerts(data.alerts);
    } catch {}
  }

  async function loadKeywordAlerts(kwId) {
    try {
      var res = await fetch('/api/keywords/' + kwId + '/alerts');
      var data = await res.json();
      renderDetailAlerts(data.alerts);
    } catch {
      detailAlerts.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  async function loadKeywordTrends(kwId) {
    try {
      var res = await fetch('/api/keywords/' + kwId + '/trends');
      var data = await res.json();
      renderDetailTrends(data.items);
    } catch {
      detailTrends.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  // === Render: Trends ===
  function renderTrends(items) {
    if (!items || items.length === 0) {
      trendsList.innerHTML = '<div class="empty-state">暂无数据，等待首次采集…</div>';
      return;
    }

    trendsList.innerHTML = items.map(function (item, i) {
      var extra = {};
      try { extra = JSON.parse(item.extra || '{}'); } catch {}

      var isTweet = item.source === 'twitter' && extra.type === 'tweet';

      // Twitter 推文特殊展示：显示作者信息
      var titleHtml;
      if (isTweet) {
        var authorTag = extra.author ? '<span class="tw-author">@' + esc(extra.author) + '</span> ' : '';
        var verifiedTag = extra.isVerified ? '<span class="tw-verified" title="认证账号">✓</span> ' : '';
        var textContent = item.url
          ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a>'
          : esc(item.title);
        titleHtml = authorTag + verifiedTag + textContent;
      } else {
        titleHtml = item.url
          ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a>'
          : esc(item.title);
      }

      var rankNum = (currentPage - 1) * PAGE_SIZE + i + 1;
      var rankCls = rankNum <= 3 ? ' top3' : '';

      var metaParts = [];
      if (item.score > 0) metaParts.push('<span class="score-text">' + formatScore(item.score) + '</span>');

      // Twitter 推文：显示互动数据
      if (isTweet) {
        if (extra.likes) metaParts.push('❤ ' + formatScore(extra.likes));
        if (extra.retweets) metaParts.push('🔁 ' + formatScore(extra.retweets));
        if (extra.views) metaParts.push('👁 ' + formatScore(extra.views));
        if (extra.followers) metaParts.push(formatScore(extra.followers) + ' followers');
      } else if (item.source === 'github') {
        if (extra.language) metaParts.push('<span class="gh-lang">' + esc(extra.language) + '</span>');
        if (extra.stars) metaParts.push('⭐ ' + formatScore(extra.stars));
        if (extra.todayStars) metaParts.push('+' + formatScore(extra.todayStars) + ' today');
      } else if (item.source === 'huggingface') {
        if (extra.type === 'model') {
          if (extra.pipeline) metaParts.push(esc(extra.pipeline));
          if (extra.likes) metaParts.push('❤ ' + formatScore(extra.likes));
        } else if (extra.type === 'paper') {
          if (extra.upvotes) metaParts.push('👍 ' + extra.upvotes);
        }
      } else if (item.source === 'v2ex') {
        if (extra.node) metaParts.push(esc(extra.node));
        if (extra.replies) metaParts.push(extra.replies + ' 回复');
        if (extra.author) metaParts.push('@' + esc(extra.author));
      } else if (item.source === 'bingnews') {
        if (extra.newsSource) metaParts.push(esc(extra.newsSource));
      } else {
        if (extra.num_comments) metaParts.push(formatScore(extra.num_comments) + ' comments');
        if (extra.subreddit) metaParts.push('r/' + esc(extra.subreddit));
        if (extra.author) metaParts.push('@' + esc(extra.author));
        if (extra.comments) metaParts.push(formatScore(extra.comments) + ' comments');
      }

      // 优先用 publishedAt，没有则用 fetchedAt
      var displayTime = item.publishedAt || item.fetchedAt;
      metaParts.push(timeAgo(displayTime));

      var delay = Math.min(i * 30, 300);

      return '<div class="trend-item" style="animation-delay:' + delay + 'ms">'
        + '<span class="trend-rank' + rankCls + '">' + rankNum + '</span>'
        + '<div class="trend-body">'
        + '<div class="trend-title">' + titleHtml + '</div>'
        + '<div class="trend-meta">'
        + '<span class="source-tag ' + esc(item.source) + '">' + esc(item.source) + '</span>'
        + metaParts.join('<span>·</span>')
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Render: Source filters ===
  function renderSourceFilters(sources) {
    var labels = {
      google: 'Google', reddit: 'Reddit', hackernews: 'HN', duckduckgo: 'DDG',
      twitter: 'Twitter', github: 'GitHub', huggingface: 'HF', v2ex: 'V2EX', bingnews: 'Bing News'
    };
    var html = '<button class="pill' + (currentSource === 'all' ? ' active' : '') + '" data-source="all">全部</button>';
    sources.forEach(function (s) {
      html += '<button class="pill' + (currentSource === s ? ' active' : '') + '" data-source="' + s + '">'
        + (labels[s] || s) + '</button>';
    });
    sourceFilters.innerHTML = html;
  }

  // === Render: Pagination ===
  function renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }
    var html = '<button ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">上一页</button>';
    for (var p = 1; p <= pagination.totalPages; p++) {
      if (pagination.totalPages > 7 && p > 2 && p < pagination.totalPages - 1 && Math.abs(p - currentPage) > 1) {
        if (p === 3 || p === pagination.totalPages - 2) html += '<button disabled>…</button>';
        continue;
      }
      html += '<button ' + (p === currentPage ? 'class="current" disabled' : '') + ' data-page="' + p + '">' + p + '</button>';
    }
    html += '<button ' + (currentPage >= pagination.totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">下一页</button>';
    paginationEl.innerHTML = html;
  }

  // === Render: AI Analysis ===
  function renderAnalysis(data) {
    analysisPanel.style.display = '';
    analysisSummary.textContent = data.summary || '';
    if (data.createdAt) analysisTime.textContent = timeAgo(data.createdAt);

    var topics = data.topics || [];
    analysisTopics.innerHTML = topics.map(function (t) {
      var heat = t.heat || 'medium';
      var sources = (t.sources || []).join(', ');
      return '<span class="chip ' + heat + '" title="' + esc(t.description || '') + ' (' + esc(sources) + ')">'
        + '<span class="dot"></span>'
        + esc(t.name)
        + '</span>';
    }).join('');
  }

  // === Render: Keyword list ===
  function renderKeywordList(keywords) {
    if (!keywords || keywords.length === 0) {
      keywordListEl.innerHTML = '<div class="empty-state">暂无监控关键词，请添加</div>';
      return;
    }
    keywordListEl.innerHTML = keywords.map(function (kw, i) {
      var cls = kw.active ? '' : ' inactive';
      var delay = Math.min(i * 40, 300);
      return '<div class="kw-card' + cls + '" data-kwid="' + kw.id + '" style="animation-delay:' + delay + 'ms">'
        + '<span class="kw-name">' + esc(kw.keyword) + '</span>'
        + (kw.scope !== 'general' ? '<span class="kw-scope">' + esc(kw.scope) + '</span>' : '')
        + '<span class="kw-stats">' + (kw._count?.alerts || 0) + ' 告警 · ' + (kw._count?.trends || 0) + ' 热点</span>'
        + '<div class="kw-btns">'
        + '<button class="kw-btn toggle-btn" data-kwid="' + kw.id + '" data-active="' + kw.active + '">' + (kw.active ? '暂停' : '启用') + '</button>'
        + '<button class="kw-btn danger delete-btn" data-kwid="' + kw.id + '">删除</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Render: Detail alerts ===
  function renderDetailAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      detailAlerts.innerHTML = '<div class="empty-state">暂无告警</div>';
      return;
    }
    detailAlerts.innerHTML = alerts.map(function (a, i) {
      var titleHtml = a.url
        ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>'
        : esc(a.title);
      var vCls = a.verified ? 'yes' : 'no';
      var vLabel = a.verified ? '已验证' : '未通过';
      var delay = Math.min(i * 30, 200);
      return '<div class="alert-row" style="animation-delay:' + delay + 'ms">'
        + '<div class="a-title">' + titleHtml + '</div>'
        + '<div class="a-meta">'
        + '<span class="source-tag ' + esc(a.source) + '">' + esc(a.source) + '</span>'
        + '<span class="verified-tag ' + vCls + '">' + vLabel + '</span>'
        + '<span>' + timeAgo(a.createdAt) + '</span>'
        + '</div>'
        + (a.aiReason ? '<div class="ai-reason">AI: ' + esc(a.aiReason) + '</div>' : '')
        + '</div>';
    }).join('');
  }

  // === Render: Detail trends ===
  function renderDetailTrends(items) {
    if (!items || items.length === 0) {
      detailTrends.innerHTML = '<div class="empty-state">暂无相关热点</div>';
      return;
    }
    detailTrends.innerHTML = items.map(function (item, i) {
      var titleHtml = item.url
        ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a>'
        : esc(item.title);
      var delay = Math.min(i * 30, 200);
      return '<div class="alert-row" style="animation-delay:' + delay + 'ms">'
        + '<div class="a-title">' + titleHtml + '</div>'
        + '<div class="a-meta">'
        + '<span class="source-tag ' + esc(item.source) + '">' + esc(item.source) + '</span>'
        + (item.score > 0 ? '<span class="score-text">' + formatScore(item.score) + '</span>' : '')
        + '<span>' + timeAgo(item.fetchedAt) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Render: Recent alerts ===
  function renderRecentAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      recentAlertsEl.innerHTML = '<div class="empty-state">暂无告警记录</div>';
      return;
    }
    recentAlertsEl.innerHTML = alerts.map(function (a, i) {
      var titleHtml = a.url
        ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>'
        : esc(a.title);
      var delay = Math.min(i * 30, 200);
      return '<div class="ra-item" style="animation-delay:' + delay + 'ms">'
        + '<div class="ra-kw">' + esc(a.keyword?.keyword || '') + '</div>'
        + '<div class="ra-title">' + titleHtml + '</div>'
        + '<div class="ra-meta">'
        + '<span class="source-tag ' + esc(a.source) + '">' + esc(a.source) + '</span>'
        + ' · ' + timeAgo(a.createdAt)
        + (a.aiReason ? ' · AI: ' + esc(a.aiReason) : '')
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Keyword events ===
  addKeywordBtn.addEventListener('click', async function () {
    var kw = keywordInput.value.trim();
    if (!kw) return;
    addKeywordBtn.disabled = true;
    try {
      var res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, scope: scopeInput.value.trim() || 'general' }),
      });
      var data = await res.json();
      if (res.ok) {
        keywordInput.value = '';
        scopeInput.value = '';
        loadKeywords();
      } else {
        showToast(data.error || '添加失败', 'err');
      }
    } catch { showToast('网络错误', 'err'); }
    addKeywordBtn.disabled = false;
  });

  keywordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addKeywordBtn.click();
  });

  checkKeywordsBtn.addEventListener('click', async function () {
    checkKeywordsBtn.disabled = true;
    checkKeywordsBtn.querySelector('span') || (checkKeywordsBtn.textContent = '检查中…');
    try { await fetch('/api/keywords/check', { method: 'POST' }); } catch {}
    setTimeout(function () {
      checkKeywordsBtn.disabled = false;
      loadKeywords();
      loadRecentAlerts();
    }, 3000);
  });

  collectKeywordTrendsBtn.addEventListener('click', async function () {
    collectKeywordTrendsBtn.disabled = true;
    try { await fetch('/api/keywords/collect', { method: 'POST' }); } catch {}
    setTimeout(function () {
      collectKeywordTrendsBtn.disabled = false;
      loadKeywords();
    }, 5000);
  });

  keywordListEl.addEventListener('click', function (e) {
    var target = e.target;
    if (target.classList.contains('delete-btn')) {
      e.stopPropagation();
      var kwId = target.dataset.kwid;
      if (confirm('确定删除该关键词？')) {
        fetch('/api/keywords/' + kwId, { method: 'DELETE' }).then(function () { loadKeywords(); });
      }
      return;
    }
    if (target.classList.contains('toggle-btn')) {
      e.stopPropagation();
      var kwId2 = target.dataset.kwid;
      var isActive = target.dataset.active === 'true';
      fetch('/api/keywords/' + kwId2, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !isActive }),
      }).then(function () { loadKeywords(); });
      return;
    }
    var card = target.closest('.kw-card');
    if (card) {
      var id = parseInt(card.dataset.kwid);
      var name = card.querySelector('.kw-name').textContent;
      openKeywordDetail(id, name);
    }
  });

  function openKeywordDetail(kwId, kwName) {
    currentDetailKeywordId = kwId;
    detailTitle.textContent = kwName;
    keywordDetail.style.display = '';
    detailAlerts.style.display = '';
    detailTrends.style.display = 'none';
    document.querySelectorAll('.detail-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.dtab === 'alerts');
    });
    loadKeywordAlerts(kwId);
  }

  closeDetail.addEventListener('click', function () {
    keywordDetail.style.display = 'none';
    currentDetailKeywordId = null;
  });

  document.querySelector('.detail-tabs').addEventListener('click', function (e) {
    if (!e.target.classList.contains('detail-tab-btn')) return;
    document.querySelectorAll('.detail-tab-btn').forEach(function (b) { b.classList.remove('active'); });
    e.target.classList.add('active');
    var dtab = e.target.dataset.dtab;
    detailAlerts.style.display = dtab === 'alerts' ? '' : 'none';
    detailTrends.style.display = dtab === 'ktrends' ? '' : 'none';
    if (dtab === 'ktrends' && currentDetailKeywordId) {
      loadKeywordTrends(currentDetailKeywordId);
    }
  });

  // === Source filter clicks ===
  sourceFilters.addEventListener('click', function (e) {
    if (e.target.classList.contains('pill')) {
      currentSource = e.target.dataset.source;
      currentPage = 1;
      loadTrends();
      loadSources();
    }
  });

  paginationEl.addEventListener('click', function (e) {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.page) {
      currentPage = parseInt(e.target.dataset.page);
      loadTrends();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  refreshBtn.addEventListener('click', async function () {
    refreshBtn.disabled = true;
    try { await fetch('/api/trends/refresh', { method: 'POST' }); } catch {}
    setTimeout(function () { refreshBtn.disabled = false; }, 5000);
  });

  analyzeBtn.addEventListener('click', async function () {
    analyzeBtn.disabled = true;
    try { await fetch('/api/trends/analyze', { method: 'POST' }); } catch {}
    setTimeout(function () { analyzeBtn.disabled = false; }, 10000);
  });

  alertDismiss.addEventListener('click', function () {
    alertBanner.style.display = 'none';
  });

  // === Socket.IO ===
  socket.on('connect', function () {
    statusEl.textContent = '已连接';
    statusEl.className = 'conn-badge online';
  });

  socket.on('disconnect', function () {
    statusEl.textContent = '断开连接';
    statusEl.className = 'conn-badge offline';
  });

  socket.on('new-trends', function (data) {
    statusEl.textContent = '新数据 ' + data.items.length + ' 条';
    statusEl.className = 'conn-badge online';
    loadTrends();
    loadSources();
  });

  socket.on('fetch-status', function (data) {
    data.results.forEach(function (r) {
      var cls = r.error ? 't-err' : 't-ok';
      var msg = r.error ? '失败' : r.count + ' 条';
      showToast('<span class="t-source">' + esc(r.source) + '</span> <span class="' + cls + '">' + msg + '</span>');
    });
    refreshBtn.disabled = false;
  });

  socket.on('analysis-update', function (data) {
    if (data.analysis) {
      renderAnalysis(data.analysis);
      analyzeBtn.disabled = false;
    }
  });

  socket.on('keyword-alert', function (data) {
    var count = data.alerts ? data.alerts.length : 0;
    alertText.textContent = '「' + data.keyword + '」发现 ' + count + ' 条新的相关内容';
    alertBanner.style.display = '';
    alertCount += count;
    alertCountEl.textContent = String(alertCount);
    alertCountEl.style.display = '';
    setTimeout(function () { alertBanner.style.display = 'none'; }, 10000);

    if (keywordsTab.classList.contains('active')) {
      loadRecentAlerts();
      if (currentDetailKeywordId === data.keywordId) loadKeywordAlerts(data.keywordId);
    }
  });

  socket.on('keyword-trends-update', function () {
    if (keywordsTab.classList.contains('active')) {
      loadKeywords();
      if (currentDetailKeywordId) loadKeywordTrends(currentDetailKeywordId);
    }
  });

  // === Toast helper ===
  function showToast(html, type) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    fetchStatusEl.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  // === Utils ===
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatScore(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function timeAgo(dateStr) {
    var d = new Date(dateStr);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    return Math.floor(diff / 86400) + '天前';
  }

  // === Init ===
  loadTrends();
  loadSources();
  loadAnalysis();
})();
