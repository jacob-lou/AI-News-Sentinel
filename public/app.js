(function () {
  'use strict';

  const socket = io();
  let alertCount = 0;
  let currentDetailKeywordId = null;

  // === Filter state per tab ===
  const aiState = {
    page: 1, pageSize: 50, sort: 'score', sources: [], search: '',
    days: 30, minScore: 0, hasUrl: false,
  };
  const generalState = {
    page: 1, pageSize: 50, sort: 'score', sources: [], search: '',
    days: 30, minScore: 0, hasUrl: false,
  };
  const kwState = { sort: 'fetchedAt', days: 0 };

  // Compact mode
  let isCompact = localStorage.getItem('compact') === 'true';

  // === DOM refs ===
  const trendsList = document.getElementById('trendsList');
  const refreshBtn = document.getElementById('refreshBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('status');
  const paginationEl = document.getElementById('pagination');
  const fetchStatusEl = document.getElementById('fetchStatus');
  const analysisPanel = document.getElementById('analysisPanel');
  const analysisSummary = document.getElementById('analysisSummary');
  const analysisTopics = document.getElementById('analysisTopics');
  const analysisTime = document.getElementById('analysisTime');

  const generalTrendsList = document.getElementById('generalTrendsList');
  const generalPaginationEl = document.getElementById('generalPagination');

  const tabBtns = document.querySelectorAll('.tab-item');
  const trendsTab = document.getElementById('trendsTab');
  const generalTab = document.getElementById('generalTab');
  const keywordsTab = document.getElementById('keywordsTab');

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
  const detailTrendsInner = document.getElementById('detailTrendsInner');
  const recentAlertsEl = document.getElementById('recentAlerts');

  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  const alertDismiss = document.getElementById('alertDismiss');
  const alertCountEl = document.getElementById('alertCount');

  // Source labels
  const sourceLabels = {
    google: 'Google', reddit: 'Reddit', hackernews: 'HN', duckduckgo: 'DDG',
    twitter: 'Twitter', github: 'GitHub', huggingface: 'HF', v2ex: 'V2EX',
    bingnews: 'Bing News', bilibili: 'B站',
  };

  // === Compact mode init ===
  if (isCompact) document.body.classList.add('compact');

  // === Generic dropdown logic ===
  function initDropdown(container, onChange) {
    if (!container) return;
    var trigger = container.querySelector('.dropdown-trigger');
    var menu = container.querySelector('.dropdown-menu');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAllDropdowns();
      container.classList.toggle('open');
    });
    menu.addEventListener('click', function (e) {
      var item = e.target.closest('.dropdown-item');
      if (!item) return;
      if (container.classList.contains('multi')) {
        // multi-select: toggle checkbox
        var cb = item.querySelector('input[type="checkbox"]');
        if (cb && e.target !== cb) cb.checked = !cb.checked;
        if (onChange) onChange();
      } else {
        // single-select
        menu.querySelectorAll('.dropdown-item').forEach(function (b) { b.classList.remove('active'); });
        item.classList.add('active');
        trigger.dataset.value = item.dataset.value;
        trigger.querySelector('span').textContent = item.textContent.trim();
        container.classList.remove('open');
        if (onChange) onChange(item.dataset.value);
      }
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
  }
  document.addEventListener('click', closeAllDropdowns);

  // === Multi-select source dropdown renderer ===
  function renderSourceMenu(menuEl, sources, state) {
    var html = '<label class="dropdown-item select-all"><input type="checkbox" checked /> 全选</label>';
    sources.forEach(function (s) {
      var checked = state.sources.length === 0 || state.sources.indexOf(s) !== -1;
      html += '<label class="dropdown-item"><input type="checkbox" value="' + s + '"' + (checked ? ' checked' : '') + ' /> ' + (sourceLabels[s] || s) + '</label>';
    });
    menuEl.innerHTML = html;

    // select-all logic
    var selectAll = menuEl.querySelector('.select-all input');
    var boxes = menuEl.querySelectorAll('input[value]');
    selectAll.addEventListener('change', function () {
      boxes.forEach(function (cb) { cb.checked = selectAll.checked; });
    });
    boxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        selectAll.checked = Array.from(boxes).every(function (b) { return b.checked; });
      });
    });
  }

  function getSelectedSources(menuEl) {
    var boxes = menuEl.querySelectorAll('input[value]');
    var all = [];
    var selected = [];
    boxes.forEach(function (cb) {
      all.push(cb.value);
      if (cb.checked) selected.push(cb.value);
    });
    // if all selected, return [] (means "all")
    return selected.length === all.length ? [] : selected;
  }

  // === Pill-based filter logic ===
  function initPills(container, callback) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.pill-sm');
      if (!btn) return;
      container.querySelectorAll('.pill-sm').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      if (callback) callback(btn);
    });
  }

  // === Debounced search ===
  function debounce(fn, ms) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  // === Build query params ===
  function buildTrendParams(state, category) {
    var params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.pageSize),
      category: category,
      sort: state.sort,
      days: String(state.days),
    });
    if (state.sources.length > 0) params.set('source', state.sources.join(','));
    if (state.search) params.set('search', state.search);
    if (state.minScore > 0) params.set('minScore', String(state.minScore));
    if (state.hasUrl) params.set('hasUrl', 'true');
    return params;
  }

  // === Tab switching ===
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.dataset.tab;
      trendsTab.style.display = tab === 'trends' ? '' : 'none';
      trendsTab.classList.toggle('active', tab === 'trends');
      generalTab.style.display = tab === 'general' ? '' : 'none';
      generalTab.classList.toggle('active', tab === 'general');
      keywordsTab.style.display = tab === 'keywords' ? '' : 'none';
      keywordsTab.classList.toggle('active', tab === 'keywords');
      if (tab === 'trends') {
        loadTrends();
        loadSources('ai');
      } else if (tab === 'general') {
        loadGeneralTrends();
        loadSources('general');
        loadAnalysis();
      } else if (tab === 'keywords') {
        loadKeywords();
        loadRecentAlerts();
      }
    });
  });

  // === Data loaders ===
  function showSkeleton(container) {
    container.innerHTML = '<div class="skeleton-group">'
      + '<div class="skeleton-line w80"></div>'
      + '<div class="skeleton-line w60"></div>'
      + '<div class="skeleton-line w80"></div>'
      + '<div class="skeleton-line w40"></div>'
      + '<div class="skeleton-line w80"></div>'
      + '</div>';
  }

  async function loadTrends() {
    var params = buildTrendParams(aiState, 'ai');
    showSkeleton(trendsList);
    try {
      var res = await fetch('/api/trends?' + params.toString());
      var data = await res.json();
      renderTrends(data.items, trendsList, aiState.page, aiState.pageSize);
      renderPagination(data.pagination, paginationEl, function (p) { aiState.page = p; loadTrends(); });
    } catch {
      trendsList.innerHTML = '<div class="empty-state">加载失败，请刷新重试</div>';
    }
  }

  async function loadGeneralTrends() {
    var params = buildTrendParams(generalState, 'general');
    showSkeleton(generalTrendsList);
    try {
      var res = await fetch('/api/trends?' + params.toString());
      var data = await res.json();
      renderTrends(data.items, generalTrendsList, generalState.page, generalState.pageSize);
      renderPagination(data.pagination, generalPaginationEl, function (p) { generalState.page = p; loadGeneralTrends(); });
    } catch {
      generalTrendsList.innerHTML = '<div class="empty-state">加载失败，请刷新重试</div>';
    }
  }

  async function loadSources(category) {
    try {
      var res = await fetch('/api/trends/sources?category=' + encodeURIComponent(category));
      var data = await res.json();
      if (category === 'general') {
        renderSourceMenu(document.getElementById('generalSourceMenu'), data.sources, generalState);
      } else {
        renderSourceMenu(document.getElementById('aiSourceMenu'), data.sources, aiState);
      }
    } catch {}
  }

  async function loadAnalysis() {
    try {
      var res = await fetch('/api/trends/analysis');
      var data = await res.json();
      if (data.analysis) {
        renderAnalysis(data.analysis);
        renderAnalysis(data.analysis, 'general');
      }
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
    var params = new URLSearchParams({ sort: kwState.sort });
    if (kwState.days > 0) params.set('days', String(kwState.days));
    try {
      var res = await fetch('/api/keywords/' + kwId + '/trends?' + params.toString());
      var data = await res.json();
      renderDetailTrends(data.items);
    } catch {
      detailTrendsInner.innerHTML = '<div class="empty-state">加载失败</div>';
    }
  }

  // === Render: Trends ===
  function renderTrends(items, container, page, pageSize) {
    if (!container) container = trendsList;
    if (!page) page = 1;
    if (!pageSize) pageSize = 50;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无数据，等待首次采集…</div>';
      return;
    }

    container.innerHTML = items.map(function (item, i) {
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

      var rankNum = (page - 1) * pageSize + i + 1;
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
      } else if (item.source === 'bilibili') {
        if (extra.type === 'hot_search') {
          metaParts.push('热搜');
        } else if (extra.type === 'tech_video') {
          if (extra.views) metaParts.push('▶ ' + formatScore(extra.views));
          if (extra.likes) metaParts.push('❤ ' + formatScore(extra.likes));
          if (extra.author) metaParts.push(esc(extra.author));
        }
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

  // === Render: Pagination ===
  function renderPagination(pagination, container, onPageChange) {
    if (!container) container = paginationEl;
    var activePage = pagination.page || 1;
    if (!pagination || pagination.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    var html = '<button ' + (activePage <= 1 ? 'disabled' : '') + ' data-page="' + (activePage - 1) + '">上一页</button>';
    for (var p = 1; p <= pagination.totalPages; p++) {
      if (pagination.totalPages > 7 && p > 2 && p < pagination.totalPages - 1 && Math.abs(p - activePage) > 1) {
        if (p === 3 || p === pagination.totalPages - 2) html += '<button disabled>…</button>';
        continue;
      }
      html += '<button ' + (p === activePage ? 'class="current" disabled' : '') + ' data-page="' + p + '">' + p + '</button>';
    }
    html += '<button ' + (activePage >= pagination.totalPages ? 'disabled' : '') + ' data-page="' + (activePage + 1) + '">下一页</button>';
    container.innerHTML = html;

    if (onPageChange) {
      container.onclick = function (e) {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.page) {
          onPageChange(parseInt(e.target.dataset.page));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    }
  }

  // === Render: AI Analysis ===
  function renderAnalysis(data, target) {
    var panel, summary, time, topicsEl;
    if (target === 'general') {
      panel = document.getElementById('generalAnalysisPanel');
      summary = document.getElementById('generalAnalysisSummary');
      time = document.getElementById('generalAnalysisTime');
      topicsEl = document.getElementById('generalAnalysisTopics');
    } else {
      panel = analysisPanel;
      summary = analysisSummary;
      time = analysisTime;
      topicsEl = analysisTopics;
    }
    if (!panel) return;
    panel.style.display = '';
    summary.textContent = data.summary || '';
    if (data.createdAt) time.textContent = timeAgo(data.createdAt);

    var topics = data.topics || [];
    topicsEl.innerHTML = topics.map(function (t) {
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
    var target = detailTrendsInner || detailTrends;
    if (!items || items.length === 0) {
      target.innerHTML = '<div class="empty-state">暂无相关热点</div>';
      return;
    }
    target.innerHTML = items.map(function (item, i) {
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

  // === Toolbar initialization ===

  // AI Tab toolbar
  var aiSearchInput = document.getElementById('aiSearch');
  var aiSortDropdown = document.getElementById('aiSortDropdown');
  var aiSourceDropdown = document.getElementById('aiSourceDropdown');
  var aiMoreFilters = document.getElementById('aiMoreFilters');
  var aiFiltersPanel = document.getElementById('aiFiltersPanel');
  var aiTimePills = document.getElementById('aiTimePills');
  var aiScorePills = document.getElementById('aiScorePills');
  var aiHasUrl = document.getElementById('aiHasUrl');
  var aiPageSizeEl = document.getElementById('aiPageSize');
  var compactToggle = document.getElementById('compactToggle');

  function reloadAi() { aiState.page = 1; loadTrends(); }

  initDropdown(aiSortDropdown, function (val) { aiState.sort = val; reloadAi(); });
  initDropdown(aiSourceDropdown, function () {
    aiState.sources = getSelectedSources(document.getElementById('aiSourceMenu'));
    reloadAi();
  });

  aiSearchInput.addEventListener('input', debounce(function () {
    aiState.search = aiSearchInput.value.trim();
    reloadAi();
  }, 300));
  aiSearchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { aiState.search = aiSearchInput.value.trim(); reloadAi(); }
  });

  aiMoreFilters.addEventListener('click', function () {
    var panel = aiFiltersPanel;
    var show = panel.style.display === 'none';
    panel.style.display = show ? '' : 'none';
    aiMoreFilters.classList.toggle('active', show);
  });

  initPills(aiTimePills, function (btn) { aiState.days = parseInt(btn.dataset.days) || 30; reloadAi(); });
  initPills(aiScorePills, function (btn) { aiState.minScore = parseInt(btn.dataset.score) || 0; reloadAi(); });
  aiHasUrl.addEventListener('change', function () { aiState.hasUrl = aiHasUrl.checked; reloadAi(); });
  aiPageSizeEl.addEventListener('change', function () { aiState.pageSize = parseInt(aiPageSizeEl.value) || 50; reloadAi(); });

  // Compact mode toggle
  compactToggle.addEventListener('click', function () {
    isCompact = !isCompact;
    document.body.classList.toggle('compact', isCompact);
    localStorage.setItem('compact', isCompact);
  });

  // General Tab toolbar
  var generalSearchInput = document.getElementById('generalSearch');
  var generalSortDropdown = document.getElementById('generalSortDropdown');
  var generalSourceDropdown = document.getElementById('generalSourceDropdown');
  var generalMoreFilters = document.getElementById('generalMoreFilters');
  var generalFiltersPanel = document.getElementById('generalFiltersPanel');
  var generalTimePills = document.getElementById('generalTimePills');
  var generalScorePills = document.getElementById('generalScorePills');
  var generalHasUrl = document.getElementById('generalHasUrl');
  var generalPageSizeEl = document.getElementById('generalPageSize');

  function reloadGeneral() { generalState.page = 1; loadGeneralTrends(); }

  initDropdown(generalSortDropdown, function (val) { generalState.sort = val; reloadGeneral(); });
  initDropdown(generalSourceDropdown, function () {
    generalState.sources = getSelectedSources(document.getElementById('generalSourceMenu'));
    reloadGeneral();
  });

  generalSearchInput.addEventListener('input', debounce(function () {
    generalState.search = generalSearchInput.value.trim();
    reloadGeneral();
  }, 300));
  generalSearchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { generalState.search = generalSearchInput.value.trim(); reloadGeneral(); }
  });

  generalMoreFilters.addEventListener('click', function () {
    var panel = generalFiltersPanel;
    var show = panel.style.display === 'none';
    panel.style.display = show ? '' : 'none';
    generalMoreFilters.classList.toggle('active', show);
  });

  initPills(generalTimePills, function (btn) { generalState.days = parseInt(btn.dataset.days) || 30; reloadGeneral(); });
  initPills(generalScorePills, function (btn) { generalState.minScore = parseInt(btn.dataset.score) || 0; reloadGeneral(); });
  generalHasUrl.addEventListener('change', function () { generalState.hasUrl = generalHasUrl.checked; reloadGeneral(); });
  generalPageSizeEl.addEventListener('change', function () { generalState.pageSize = parseInt(generalPageSizeEl.value) || 50; reloadGeneral(); });

  // Keywords detail toolbar
  var kwSortDropdown = document.getElementById('kwSortDropdown');
  var kwTimePills = document.getElementById('kwTimePills');

  initDropdown(kwSortDropdown, function (val) {
    kwState.sort = val;
    if (currentDetailKeywordId) loadKeywordTrends(currentDetailKeywordId);
  });
  initPills(kwTimePills, function (btn) {
    kwState.days = parseInt(btn.dataset.days) || 0;
    if (currentDetailKeywordId) loadKeywordTrends(currentDetailKeywordId);
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
    if (trendsTab.classList.contains('active')) { loadTrends(); loadSources('ai'); }
    if (generalTab.classList.contains('active')) { loadGeneralTrends(); loadSources('general'); }
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
      renderAnalysis(data.analysis, 'general');
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
  loadSources('ai');
  loadAnalysis();
})();
