(function () {
  'use strict';

  const socket = io();
  let currentSource = 'all';
  let currentPage = 1;
  const PAGE_SIZE = 50;
  let currentDetailKeywordId = null;

  // Elements - Trends
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

  // Elements - Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const trendsTab = document.getElementById('trendsTab');
  const keywordsTab = document.getElementById('keywordsTab');

  // Elements - Keywords
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

  // Elements - Alert banner
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  const alertDismiss = document.getElementById('alertDismiss');

  // === Tab switching ===
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.dataset.tab;
      trendsTab.style.display = tab === 'trends' ? 'block' : 'none';
      trendsTab.classList.toggle('active', tab === 'trends');
      keywordsTab.style.display = tab === 'keywords' ? 'block' : 'none';
      keywordsTab.classList.toggle('active', tab === 'keywords');
      if (tab === 'keywords') {
        loadKeywords();
        loadRecentAlerts();
      }
    });
  });

  // === Load data ===
  async function loadTrends() {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(PAGE_SIZE),
    });
    if (currentSource !== 'all') {
      params.set('source', currentSource);
    }

    trendsList.innerHTML = '<div class="loading">加载中...</div>';

    try {
      const res = await fetch('/api/trends?' + params.toString());
      const data = await res.json();
      renderTrends(data.items);
      renderPagination(data.pagination);
    } catch (err) {
      trendsList.innerHTML = '<div class="loading">加载失败，请刷新重试</div>';
    }
  }

  async function loadSources() {
    try {
      const res = await fetch('/api/trends/sources');
      const data = await res.json();
      renderSourceFilters(data.sources);
    } catch {
      // Keep default "all" filter
    }
  }

  async function loadAnalysis() {
    try {
      const res = await fetch('/api/trends/analysis');
      const data = await res.json();
      if (data.analysis) {
        renderAnalysis(data.analysis);
      }
      // Hide analyze button if not configured
      if (!data.configured) {
        analyzeBtn.style.display = 'none';
      }
    } catch {}
  }

  // === Keywords ===
  async function loadKeywords() {
    try {
      var res = await fetch('/api/keywords');
      var data = await res.json();
      renderKeywordList(data.keywords);
    } catch {
      keywordListEl.innerHTML = '<div class="loading">加载失败</div>';
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
      detailAlerts.innerHTML = '<div class="loading">加载失败</div>';
    }
  }

  async function loadKeywordTrends(kwId) {
    try {
      var res = await fetch('/api/keywords/' + kwId + '/trends');
      var data = await res.json();
      renderDetailTrends(data.items);
    } catch {
      detailTrends.innerHTML = '<div class="loading">加载失败</div>';
    }
  }

  function renderKeywordList(keywords) {
    if (!keywords || keywords.length === 0) {
      keywordListEl.innerHTML = '<div class="loading">暂无监控关键词，请添加</div>';
      return;
    }
    keywordListEl.innerHTML = keywords.map(function (kw) {
      var cls = kw.active ? '' : ' inactive';
      return '<div class="keyword-card' + cls + '" data-kwid="' + kw.id + '">'
        + '<span class="kw-name">' + escapeHtml(kw.keyword) + '</span>'
        + (kw.scope !== 'general' ? '<span class="kw-scope">' + escapeHtml(kw.scope) + '</span>' : '')
        + '<span class="kw-stats">告警 ' + (kw._count?.alerts || 0) + ' · 热点 ' + (kw._count?.trends || 0) + '</span>'
        + '<div class="kw-actions">'
        + '<button class="toggle-btn" data-kwid="' + kw.id + '" data-active="' + kw.active + '">' + (kw.active ? '暂停' : '启用') + '</button>'
        + '<button class="delete-btn" data-kwid="' + kw.id + '">删除</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function renderDetailAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      detailAlerts.innerHTML = '<div class="loading">暂无告警</div>';
      return;
    }
    detailAlerts.innerHTML = alerts.map(function (a) {
      var titleHtml = a.url
        ? '<a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener">' + escapeHtml(a.title) + '</a>'
        : escapeHtml(a.title);
      var vClass = a.verified ? 'yes' : 'no';
      var vLabel = a.verified ? '✓ 已验证' : '✗ 未通过';
      return '<div class="alert-item">'
        + '<div class="alert-title">' + titleHtml + '</div>'
        + '<div class="alert-meta">'
        + '<span class="source-badge ' + escapeHtml(a.source) + '">' + escapeHtml(a.source) + '</span>'
        + '<span class="verified-badge ' + vClass + '">' + vLabel + '</span>'
        + '<span>' + timeAgo(a.createdAt) + '</span>'
        + '</div>'
        + (a.aiReason ? '<div class="ai-reason">AI: ' + escapeHtml(a.aiReason) + '</div>' : '')
        + '</div>';
    }).join('');
  }

  function renderDetailTrends(items) {
    if (!items || items.length === 0) {
      detailTrends.innerHTML = '<div class="loading">暂无相关热点</div>';
      return;
    }
    detailTrends.innerHTML = items.map(function (item) {
      var titleHtml = item.url
        ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a>'
        : escapeHtml(item.title);
      return '<div class="alert-item">'
        + '<div class="alert-title">' + titleHtml + '</div>'
        + '<div class="alert-meta">'
        + '<span class="source-badge ' + escapeHtml(item.source) + '">' + escapeHtml(item.source) + '</span>'
        + (item.score > 0 ? '<span class="score">🔥 ' + formatScore(item.score) + '</span>' : '')
        + '<span>' + timeAgo(item.fetchedAt) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function renderRecentAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      recentAlertsEl.innerHTML = '<div class="loading">暂无告警记录</div>';
      return;
    }
    recentAlertsEl.innerHTML = alerts.map(function (a) {
      var titleHtml = a.url
        ? '<a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener">' + escapeHtml(a.title) + '</a>'
        : escapeHtml(a.title);
      return '<div class="recent-alert-card">'
        + '<div class="ra-keyword">🔑 ' + escapeHtml(a.keyword?.keyword || '') + '</div>'
        + '<div class="ra-title">' + titleHtml + '</div>'
        + '<div class="ra-meta">'
        + '<span class="source-badge ' + escapeHtml(a.source) + '">' + escapeHtml(a.source) + '</span>'
        + ' · ' + timeAgo(a.createdAt)
        + (a.aiReason ? ' · AI: ' + escapeHtml(a.aiReason) : '')
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
        alert(data.error || '添加失败');
      }
    } catch { alert('网络错误'); }
    addKeywordBtn.disabled = false;
  });

  keywordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addKeywordBtn.click();
  });

  checkKeywordsBtn.addEventListener('click', async function () {
    checkKeywordsBtn.disabled = true;
    checkKeywordsBtn.textContent = '检查中...';
    try { await fetch('/api/keywords/check', { method: 'POST' }); } catch {}
    setTimeout(function () {
      checkKeywordsBtn.disabled = false;
      checkKeywordsBtn.textContent = '立即检查';
      loadKeywords();
      loadRecentAlerts();
    }, 3000);
  });

  collectKeywordTrendsBtn.addEventListener('click', async function () {
    collectKeywordTrendsBtn.disabled = true;
    collectKeywordTrendsBtn.textContent = '采集中...';
    try { await fetch('/api/keywords/collect', { method: 'POST' }); } catch {}
    setTimeout(function () {
      collectKeywordTrendsBtn.disabled = false;
      collectKeywordTrendsBtn.textContent = '采集关键词热点';
      loadKeywords();
    }, 5000);
  });

  keywordListEl.addEventListener('click', function (e) {
    var target = e.target;
    // Delete
    if (target.classList.contains('delete-btn')) {
      e.stopPropagation();
      var kwId = target.dataset.kwid;
      if (confirm('确定删除该关键词？')) {
        fetch('/api/keywords/' + kwId, { method: 'DELETE' }).then(function () { loadKeywords(); });
      }
      return;
    }
    // Toggle active
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
    // Click card to open detail
    var card = target.closest('.keyword-card');
    if (card) {
      var id = parseInt(card.dataset.kwid);
      var name = card.querySelector('.kw-name').textContent;
      openKeywordDetail(id, name);
    }
  });

  function openKeywordDetail(kwId, kwName) {
    currentDetailKeywordId = kwId;
    detailTitle.textContent = '📊 ' + kwName;
    keywordDetail.style.display = 'block';
    detailAlerts.style.display = 'block';
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
    detailAlerts.style.display = dtab === 'alerts' ? 'block' : 'none';
    detailTrends.style.display = dtab === 'ktrends' ? 'block' : 'none';
    if (dtab === 'ktrends' && currentDetailKeywordId) {
      loadKeywordTrends(currentDetailKeywordId);
    }
  });

  // === Render (existing) ===
  function renderTrends(items) {
    if (!items || items.length === 0) {
      trendsList.innerHTML = '<div class="loading">暂无数据，等待首次采集...</div>';
      return;
    }

    trendsList.innerHTML = items.map(function (item) {
      var extra = {};
      try { extra = JSON.parse(item.extra || '{}'); } catch {}

      var titleHtml = item.url
        ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a>'
        : escapeHtml(item.title);

      var metaParts = [];
      if (item.score > 0) metaParts.push('<span class="score">🔥 ' + formatScore(item.score) + '</span>');
      if (extra.num_comments) metaParts.push('💬 ' + formatScore(extra.num_comments));
      if (extra.subreddit) metaParts.push('r/' + escapeHtml(extra.subreddit));
      if (extra.author) metaParts.push('@' + escapeHtml(extra.author));
      if (extra.comments) metaParts.push('💬 ' + formatScore(extra.comments));
      metaParts.push(timeAgo(item.fetchedAt));

      return '<div class="trend-card">'
        + '<div class="header">'
        + '<div class="title">' + titleHtml + '</div>'
        + '<span class="source-badge ' + escapeHtml(item.source) + '">' + escapeHtml(item.source) + '</span>'
        + '</div>'
        + '<div class="meta">' + metaParts.join(' · ') + '</div>'
        + '</div>';
    }).join('');
  }

  function renderSourceFilters(sources) {
    var html = '<button class="filter-btn ' + (currentSource === 'all' ? 'active' : '') + '" data-source="all">全部</button>';
    var labels = { google: 'Google', reddit: 'Reddit', hackernews: 'HN', duckduckgo: 'DDG', twitter: 'Twitter' };
    sources.forEach(function (s) {
      html += '<button class="filter-btn ' + (currentSource === s ? 'active' : '') + '" data-source="' + s + '">'
        + (labels[s] || s) + '</button>';
    });
    sourceFilters.innerHTML = html;
  }

  function renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    var html = '';
    html += '<button ' + (currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (currentPage - 1) + '">上一页</button>';
    html += '<button disabled>第 ' + currentPage + ' / ' + pagination.totalPages + ' 页</button>';
    html += '<button ' + (currentPage >= pagination.totalPages ? 'disabled' : '') + ' data-page="' + (currentPage + 1) + '">下一页</button>';
    paginationEl.innerHTML = html;
  }

  // === Events ===
  sourceFilters.addEventListener('click', function (e) {
    if (e.target.classList.contains('filter-btn')) {
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
    }
  });

  refreshBtn.addEventListener('click', async function () {
    refreshBtn.disabled = true;
    statusEl.textContent = '采集中...';
    try {
      await fetch('/api/trends/refresh', { method: 'POST' });
    } catch {}
    setTimeout(function () {
      refreshBtn.disabled = false;
    }, 5000);
  });

  analyzeBtn.addEventListener('click', async function () {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'AI 分析中...';
    try {
      await fetch('/api/trends/analyze', { method: 'POST' });
    } catch {}
    setTimeout(function () {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析';
    }, 10000);
  });

  // === Socket.IO ===
  socket.on('connect', function () {
    statusEl.textContent = '🟢 已连接';
  });

  socket.on('disconnect', function () {
    statusEl.textContent = '🔴 断开连接';
  });

  socket.on('new-trends', function (data) {
    statusEl.textContent = '✅ 新数据 ' + data.items.length + ' 条 - ' + new Date(data.timestamp).toLocaleTimeString();
    loadTrends();
    loadSources();
  });

  socket.on('fetch-status', function (data) {
    var html = '';
    data.results.forEach(function (r) {
      var cls = r.error ? 'error' : 'success';
      var msg = r.error ? '失败' : r.count + ' 条';
      html += '<div class="fetch-toast"><span class="source-name">' + escapeHtml(r.source) + '</span>: '
        + '<span class="' + cls + '">' + msg + '</span></div>';
    });
    fetchStatusEl.innerHTML = html;
    refreshBtn.disabled = false;
    setTimeout(function () { fetchStatusEl.innerHTML = ''; }, 5000);
  });

  socket.on('analysis-update', function (data) {
    if (data.analysis) {
      renderAnalysis(data.analysis);
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI 分析';
    }
  });

  // Keyword alert notification via Socket.IO
  socket.on('keyword-alert', function (data) {
    var count = data.alerts ? data.alerts.length : 0;
    alertText.textContent = '🔑 「' + data.keyword + '」发现 ' + count + ' 条新的相关内容！';
    alertBanner.style.display = 'block';
    // Auto-hide after 10s
    setTimeout(function () { alertBanner.style.display = 'none'; }, 10000);

    // If we're on keyword tab, refresh
    if (keywordsTab.classList.contains('active')) {
      loadRecentAlerts();
      if (currentDetailKeywordId === data.keywordId) {
        loadKeywordAlerts(data.keywordId);
      }
    }
  });

  socket.on('keyword-trends-update', function () {
    if (keywordsTab.classList.contains('active')) {
      loadKeywords();
      if (currentDetailKeywordId) {
        loadKeywordTrends(currentDetailKeywordId);
      }
    }
  });

  alertDismiss.addEventListener('click', function () {
    alertBanner.style.display = 'none';
  });

  // === Render Analysis ===
  function renderAnalysis(data) {
    analysisPanel.style.display = 'block';
    analysisSummary.textContent = data.summary || '';
    if (data.createdAt) {
      analysisTime.textContent = timeAgo(data.createdAt);
    }

    var topics = data.topics || [];
    analysisTopics.innerHTML = topics.map(function (t) {
      var heat = t.heat || 'medium';
      var sources = (t.sources || []).join(', ');
      return '<span class="topic-tag ' + heat + '" title="' + escapeHtml(t.description || '') + ' (' + escapeHtml(sources) + ')">'
        + '<span class="heat-dot"></span>'
        + escapeHtml(t.name)
        + '</span>';
    }).join('');
  }

  // === Utils ===
  function escapeHtml(str) {
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
