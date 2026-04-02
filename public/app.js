(function () {
  'use strict';

  const socket = io();
  let alertCount = 0;
  let currentDetailKeywordId = null;

  // === Filter state per tab ===
  const aiState = {
    page: 1, pageSize: 20, sort: 'score', sources: [], search: '',
    days: 7, minScore: 200, hasUrl: false,
  };
  const generalState = {
    page: 1, pageSize: 20, sort: 'score', sources: [], search: '',
    days: 7, minScore: 200, hasUrl: false,
  };
  const kwState = { sort: 'fetchedAt', days: 0 };

  // Compact mode
  let isCompact = localStorage.getItem('compact') === 'true';

  // Display language: 'zh' or 'en'
  var displayLang = localStorage.getItem('displayLang') || 'zh';

  // Language labels for display
  var langLabels = { zh: '中', en: 'EN', ja: '日', ko: '한' };

  // i18n translations
  var i18n = {
    zh: {
      appTitle: '热点追踪', connected: '已连接', disconnected: '断开连接', connecting: '连接中',
      aiAnalysis: 'AI 分析', refresh: '刷新数据', tabAi: 'AI 热点', tabGeneral: '综合热点', tabKeywords: '热点监控',
      searchPlaceholder: '搜索标题…', sortHot: '最热', sortImportance: '重要程度', sortNewest: '最新发布',
      sortComments: '最多互动', sortLatest: '最新采集', sources: '数据源', filter: '筛选',
      filterTime: '时间', filterHeat: '热度', filterOptions: '选项',
      today: '今天', days3: '3天', days7: '7天', days30: '30天', days90: '90天',
      heatAll: '不限', heatMedium: '中热度', heatHigh: '高热度',
      urlOnly: '仅有链接', perPage: '每页', compact: '紧凑',
      noData: '暂无数据，等待首次采集…', loadFailed: '加载失败，请刷新重试',
      prevPage: '上一页', nextPage: '下一页',
      aiTrendAnalysis: 'AI 趋势分析', analyzing: '正在分析中…',
      generateSummary: '生成摘要', generating: '生成中…', generateFailed: '生成失败', noGenerate: '无法生成',
      justNow: '刚刚', minutesAgo: '分钟前', hoursAgo: '小时前', daysAgo: '天前',
      replies: '回复', hotSearch: '热搜', selectAll: '全选',
      noKeywords: '暂无监控关键词，请添加', noAlerts: '暂无告警', noRelated: '暂无相关热点', noAlertRecords: '暂无告警记录',
      alerts: '告警', hotspots: '热点', pause: '暂停', enable: '启用', deleteTxt: '删除',
      verified: '已验证', notVerified: '未通过', newData: '新数据', items: '条', failed: '失败',
      crossSource2: '2源热议', crossSource3: '3源热议', crossSource4: '4+源热议',
      keywordFound: '发现', newRelated: '条新的相关内容', verifiedAccount: '认证账号',
      kwPlaceholder: '输入关键词，如 AI编程', kwScope: '分类', addBtn: '添加',
      checkNow: '立即检查', collectTrends: '采集热点', closeTxt: '关闭',
      alertsTab: '告警', trendsTab: '热点', recentAlerts: '最近告警',
      byTime: '按时间', byHeat: '按热度', allTime: '全部',
    },
    en: {
      appTitle: 'Hot Topics', connected: 'Connected', disconnected: 'Disconnected', connecting: 'Connecting',
      aiAnalysis: 'AI Analysis', refresh: 'Refresh', tabAi: 'AI Trends', tabGeneral: 'General', tabKeywords: 'Monitor',
      searchPlaceholder: 'Search titles...', sortHot: 'Hottest', sortImportance: 'Importance', sortNewest: 'Newest',
      sortComments: 'Most Comments', sortLatest: 'Latest', sources: 'Sources', filter: 'Filter',
      filterTime: 'Time', filterHeat: 'Heat', filterOptions: 'Options',
      today: 'Today', days3: '3d', days7: '7d', days30: '30d', days90: '90d',
      heatAll: 'All', heatMedium: 'Medium', heatHigh: 'High',
      urlOnly: 'URL only', perPage: 'Per page', compact: 'Compact',
      noData: 'No data yet, waiting for collection...', loadFailed: 'Load failed, please retry',
      prevPage: 'Prev', nextPage: 'Next',
      aiTrendAnalysis: 'AI Trend Analysis', analyzing: 'Analyzing...',
      generateSummary: 'Summary', generating: 'Generating...', generateFailed: 'Failed', noGenerate: 'N/A',
      justNow: 'just now', minutesAgo: 'm ago', hoursAgo: 'h ago', daysAgo: 'd ago',
      replies: 'replies', hotSearch: 'Hot Search', selectAll: 'Select all',
      noKeywords: 'No keywords yet', noAlerts: 'No alerts', noRelated: 'No related trends', noAlertRecords: 'No alerts recorded',
      alerts: 'alerts', hotspots: 'trends', pause: 'Pause', enable: 'Enable', deleteTxt: 'Delete',
      verified: 'Verified', notVerified: 'Unverified', newData: 'New data', items: 'items', failed: 'Failed',
      crossSource2: '2 sources', crossSource3: '3 sources', crossSource4: '4+ sources',
      keywordFound: 'Found', newRelated: 'new related items', verifiedAccount: 'Verified',
      kwPlaceholder: 'Enter keyword, e.g. AI coding', kwScope: 'Scope', addBtn: 'Add',
      checkNow: 'Check now', collectTrends: 'Collect trends', closeTxt: 'Close',
      alertsTab: 'Alerts', trendsTab: 'Trends', recentAlerts: 'Recent Alerts',
      byTime: 'By time', byHeat: 'By heat', allTime: 'All',
    }
  };
  function t(key) { return (i18n[displayLang] || i18n.zh)[key] || i18n.zh[key] || key; }

  function applyUILanguage() {
    // Logo
    var logo = document.querySelector('.logo-text');
    if (logo) logo.textContent = t('appTitle');
    // Analyze button
    var abtn = document.querySelector('#analyzeBtn span');
    if (abtn) abtn.textContent = t('aiAnalysis');
    // Refresh title
    if (refreshBtn) refreshBtn.title = t('refresh');
    // Tabs
    tabBtns.forEach(function(btn) {
      var tab = btn.dataset.tab;
      var labels = { trends: 'tabAi', general: 'tabGeneral', keywords: 'tabKeywords' };
      var svg = btn.querySelector('svg');
      var badge = btn.querySelector('.badge');
      btn.textContent = '';
      if (svg) { btn.appendChild(svg); btn.appendChild(document.createTextNode(' ')); }
      btn.appendChild(document.createTextNode(t(labels[tab] || '')));
      if (badge) { btn.appendChild(document.createTextNode(' ')); btn.appendChild(badge); }
    });
    // Search placeholders
    document.querySelectorAll('.search-input').forEach(function(inp) { inp.placeholder = t('searchPlaceholder'); });
    // Sort dropdowns
    var sortKeys = { score: 'sortHot', importance: 'sortImportance', newest: 'sortNewest', comments: 'sortComments', fetchedAt: 'sortLatest' };
    document.querySelectorAll('#aiSortDropdown .dropdown-item, #generalSortDropdown .dropdown-item').forEach(function(el) {
      if (sortKeys[el.dataset.value]) el.textContent = t(sortKeys[el.dataset.value]);
    });
    ['aiSortDropdown', 'generalSortDropdown'].forEach(function(id) {
      var dd = document.getElementById(id);
      if (!dd) return;
      var active = dd.querySelector('.dropdown-item.active');
      if (active) dd.querySelector('.dropdown-trigger span').textContent = active.textContent.trim();
    });
    // Source triggers
    document.querySelectorAll('#aiSourceDropdown .dropdown-trigger span, #generalSourceDropdown .dropdown-trigger span').forEach(function(s) { s.textContent = t('sources'); });
    // Filter buttons
    document.querySelectorAll('#aiMoreFilters, #generalMoreFilters').forEach(function(btn) {
      var svg = btn.querySelector('svg');
      btn.textContent = '';
      if (svg) { btn.appendChild(svg); btn.appendChild(document.createTextNode(' ')); }
      btn.appendChild(document.createTextNode(t('filter')));
    });
    // Filter labels
    var fmap = {'时间':'filterTime','Time':'filterTime','热度':'filterHeat','Heat':'filterHeat','选项':'filterOptions','Options':'filterOptions'};
    document.querySelectorAll('.filter-label').forEach(function(el) { var k = fmap[el.textContent.trim()]; if (k) el.textContent = t(k); });
    // Time pills
    var dmap = {'1':'today','3':'days3','7':'days7','30':'days30','90':'days90'};
    document.querySelectorAll('.pill-sm[data-days]').forEach(function(p) { if (dmap[p.dataset.days]) p.textContent = t(dmap[p.dataset.days]); });
    // Score pills
    var smap = {'0':'heatAll','50':'heatMedium','200':'heatHigh'};
    document.querySelectorAll('.pill-sm[data-score]').forEach(function(p) { if (smap[p.dataset.score]) p.textContent = t(smap[p.dataset.score]); });
    // Toggle labels
    document.querySelectorAll('#aiHasUrl, #generalHasUrl').forEach(function(cb) {
      var label = cb.parentElement;
      if (label) { label.childNodes.forEach(function(n) { if (n.nodeType === 3) n.textContent = ' ' + t('urlOnly'); }); }
    });
    // Per page
    document.querySelectorAll('.page-size-group > span:first-child').forEach(function(s) { s.textContent = t('perPage'); });
    // Compact
    var ctgl = document.getElementById('compactToggle');
    if (ctgl) {
      var svg = ctgl.querySelector('svg');
      ctgl.textContent = '';
      if (svg) { ctgl.appendChild(svg); ctgl.appendChild(document.createTextNode(' ')); }
      ctgl.appendChild(document.createTextNode(t('compact')));
    }
    // Analysis labels
    document.querySelectorAll('.analysis-label').forEach(function(el) {
      var svg = el.querySelector('svg');
      el.textContent = '';
      if (svg) { el.appendChild(svg); el.appendChild(document.createTextNode(' ' + t('aiTrendAnalysis'))); }
    });
    // Connection status
    if (statusEl) {
      if (statusEl.classList.contains('online')) statusEl.textContent = t('connected');
      else if (statusEl.classList.contains('offline')) statusEl.textContent = t('disconnected');
      else statusEl.textContent = t('connecting');
    }
  }

  // Per-tab analysis debounce timers
  var aiAnalysisTimer = null;
  var generalAnalysisTimer = null;

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
    var html = '<label class="dropdown-item select-all"><input type="checkbox" checked /> ' + t('selectAll') + '</label>';
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
      trendsList.innerHTML = '<div class="empty-state">' + t('loadFailed') + '</div>';
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
      generalTrendsList.innerHTML = '<div class="empty-state">' + t('loadFailed') + '</div>';
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

  function buildAnalysisParams(state, category) {
    var params = new URLSearchParams({ category: category });
    if (state.sources.length > 0) params.set('source', state.sources.join(','));
    if (state.search) params.set('search', state.search);
    params.set('days', String(state.days));
    if (state.minScore > 0) params.set('minScore', String(state.minScore));
    return params;
  }

  async function loadAnalysisForTab(category, state) {
    var params = buildAnalysisParams(state, category);
    var target = category === 'general' ? 'general' : undefined;

    try {
      var res = await fetch('/api/trends/analysis?' + params.toString());
      var data = await res.json();
      if (!data.configured) { analyzeBtn.style.display = 'none'; return; }

      if (data.analysis) {
        renderAnalysis(data.analysis, target);
        // If analysis is stale (> 1 hour), trigger refresh
        var age = Date.now() - new Date(data.analysis.createdAt).getTime();
        if (age > 3600000) {
          triggerAnalysisForTab(category, state);
        }
      } else {
        triggerAnalysisForTab(category, state);
      }
    } catch {}
  }

  function triggerAnalysisForTab(category, state) {
    var body = { category: category, days: state.days };
    if (state.sources.length > 0) body.source = state.sources.join(',');
    if (state.search) body.search = state.search;
    if (state.minScore > 0) body.minScore = state.minScore;

    showAnalysisLoading(category);
    fetch('/api/trends/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(function() {});
  }

  function showAnalysisLoading(category) {
    var panel, summary;
    if (category === 'general') {
      panel = document.getElementById('generalAnalysisPanel');
      summary = document.getElementById('generalAnalysisSummary');
    } else {
      panel = analysisPanel;
      summary = analysisSummary;
    }
    if (panel) panel.style.display = '';
    if (summary) summary.innerHTML = '<span class="analysis-loading">' + t('analyzing') + '</span>';
  }

  function scheduleAnalysis(category, state) {
    if (category === 'ai') {
      clearTimeout(aiAnalysisTimer);
      aiAnalysisTimer = setTimeout(function () { loadAnalysisForTab('ai', aiState); }, 5000);
    } else {
      clearTimeout(generalAnalysisTimer);
      generalAnalysisTimer = setTimeout(function () { loadAnalysisForTab('general', generalState); }, 5000);
    }
  }

  async function loadAnalysis() {
    loadAnalysisForTab('ai', aiState);
    loadAnalysisForTab('general', generalState);
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
  function getDisplayTitle(item) {
    // Return translated title based on displayLang, or original title as fallback
    if (displayLang === 'zh') {
      if (item.language === 'zh') return item.title;
      return item.titleZh || item.title;
    } else if (displayLang === 'en') {
      if (item.language === 'en') return item.title;
      return item.titleEn || item.title;
    }
    return item.title;
  }

  function getOriginalTitle(item) {
    // Return the original title for tooltip if different from display
    var display = getDisplayTitle(item);
    return display !== item.title ? item.title : '';
  }

  function renderTrends(items, container, page, pageSize) {
    if (!container) container = trendsList;
    if (!page) page = 1;
    if (!pageSize) pageSize = 20;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state">' + t('noData') + '</div>';
      return;
    }

    container.innerHTML = items.map(function (item, i) {
      var extra = {};
      try { extra = JSON.parse(item.extra || '{}'); } catch {}

      var isTweet = item.source === 'twitter' && extra.type === 'tweet';
      var title = getDisplayTitle(item);
      var originalTitle = getOriginalTitle(item);
      var tooltipAttr = originalTitle ? ' title="' + esc(originalTitle) + '"' : '';

      // Twitter 推文特殊展示：显示作者信息
      var titleHtml;
      if (isTweet) {
        var authorTag = extra.author ? '<span class="tw-author">@' + esc(extra.author) + '</span> ' : '';
        var verifiedTag = extra.isVerified ? '<span class="tw-verified" title="' + t('verifiedAccount') + '">✓</span> ' : '';
        var textContent = item.url
          ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener"' + tooltipAttr + '>' + esc(title) + '</a>'
          : '<span' + tooltipAttr + '>' + esc(title) + '</span>';
        titleHtml = authorTag + verifiedTag + textContent;
      } else {
        titleHtml = item.url
          ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener"' + tooltipAttr + '>' + esc(title) + '</a>'
          : '<span' + tooltipAttr + '>' + esc(title) + '</span>';
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
        if (extra.replies) metaParts.push(extra.replies + ' ' + t('replies'));
        if (extra.author) metaParts.push('@' + esc(extra.author));
      } else if (item.source === 'bingnews') {
        if (extra.newsSource) metaParts.push(esc(extra.newsSource));
      } else if (item.source === 'bilibili') {
        if (extra.type === 'hot_search') {
          metaParts.push(t('hotSearch'));
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

      // Language tag
      var langTag = '';
      if (item.language) {
        var langLabel = langLabels[item.language] || item.language.toUpperCase();
        langTag = '<span class="lang-tag">' + esc(langLabel) + '</span>';
      }

      // Cross-source badge
      var crossBadge = '';
      if (item.crossSourceCount >= 2) {
        var crossKey = item.crossSourceCount >= 4 ? 'crossSource4' : 'crossSource' + item.crossSourceCount;
        crossBadge = '<span class="cross-source-badge">' + esc(t(crossKey)) + '</span>';
      }

      // Summary
      var summaryHtml = '';
      if (item.summary) {
        summaryHtml = '<div class="trend-summary">' + esc(item.summary) + '</div>';
      } else {
        summaryHtml = '<div class="trend-summary"><button class="btn-summary" data-id="' + item.id + '">' + t('generateSummary') + '</button></div>';
      }

      var delay = Math.min(i * 30, 300);

      return '<div class="trend-item" style="animation-delay:' + delay + 'ms" data-item-id="' + item.id + '">'
        + '<span class="trend-rank' + rankCls + '">' + rankNum + '</span>'
        + '<div class="trend-body">'
        + '<div class="trend-title">' + crossBadge + titleHtml + '</div>'
        + summaryHtml
        + '<div class="trend-meta">'
        + '<span class="source-tag ' + esc(item.source) + '">' + esc(item.source) + '</span>'
        + langTag
        + metaParts.join('<span>·</span>')
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Summary request ===
  function requestSummaries(ids, container) {
    fetch('/api/trends/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }),
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.summaries) {
        data.summaries.forEach(function (s) {
          var el = container.querySelector('.trend-item[data-item-id="' + s.id + '"] .trend-summary');
          if (el) el.innerHTML = esc(s.summary);
        });
      }
    })
    .catch(function () { /* silent */ });
  }

  // === Render: Pagination ===
  function renderPagination(pagination, container, onPageChange) {
    if (!container) container = paginationEl;
    var activePage = pagination.page || 1;
    if (!pagination || pagination.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    var html = '<button ' + (activePage <= 1 ? 'disabled' : '') + ' data-page="' + (activePage - 1) + '">' + t('prevPage') + '</button>';
    for (var p = 1; p <= pagination.totalPages; p++) {
      if (pagination.totalPages > 7 && p > 2 && p < pagination.totalPages - 1 && Math.abs(p - activePage) > 1) {
        if (p === 3 || p === pagination.totalPages - 2) html += '<button disabled>…</button>';
        continue;
      }
      html += '<button ' + (p === activePage ? 'class="current" disabled' : '') + ' data-page="' + p + '">' + p + '</button>';
    }
    html += '<button ' + (activePage >= pagination.totalPages ? 'disabled' : '') + ' data-page="' + (activePage + 1) + '">' + t('nextPage') + '</button>';
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
      keywordListEl.innerHTML = '<div class="empty-state">' + t('noKeywords') + '</div>';
      return;
    }
    keywordListEl.innerHTML = keywords.map(function (kw, i) {
      var cls = kw.active ? '' : ' inactive';
      var delay = Math.min(i * 40, 300);
      return '<div class="kw-card' + cls + '" data-kwid="' + kw.id + '" style="animation-delay:' + delay + 'ms">'
        + '<span class="kw-name">' + esc(kw.keyword) + '</span>'
        + (kw.scope !== 'general' ? '<span class="kw-scope">' + esc(kw.scope) + '</span>' : '')
        + '<span class="kw-stats">' + (kw._count?.alerts || 0) + ' ' + t('alerts') + ' · ' + (kw._count?.trends || 0) + ' ' + t('hotspots') + '</span>'
        + '<div class="kw-btns">'
        + '<button class="kw-btn toggle-btn" data-kwid="' + kw.id + '" data-active="' + kw.active + '">' + (kw.active ? t('pause') : t('enable')) + '</button>'
        + '<button class="kw-btn danger delete-btn" data-kwid="' + kw.id + '">' + t('deleteTxt') + '</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // === Render: Detail alerts ===
  function renderDetailAlerts(alerts) {
    if (!alerts || alerts.length === 0) {
      detailAlerts.innerHTML = '<div class="empty-state">' + t('noAlerts') + '</div>';
      return;
    }
    detailAlerts.innerHTML = alerts.map(function (a, i) {
      var titleHtml = a.url
        ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>'
        : esc(a.title);
      var vCls = a.verified ? 'yes' : 'no';
      var vLabel = a.verified ? t('verified') : t('notVerified');
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
      target.innerHTML = '<div class="empty-state">' + t('noRelated') + '</div>';
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
      recentAlertsEl.innerHTML = '<div class="empty-state">' + t('noAlertRecords') + '</div>';
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

  // Language selector
  var langDropdown = document.getElementById('langDropdown');
  initDropdown(langDropdown, function (val) {
    displayLang = val;
    localStorage.setItem('displayLang', val);
    applyUILanguage();
    // Re-render active tab with new language
    if (trendsTab.classList.contains('active')) { loadTrends(); loadSources('ai'); }
    else if (generalTab.classList.contains('active')) { loadGeneralTrends(); loadSources('general'); }
    else if (keywordsTab.classList.contains('active')) { loadKeywords(); loadRecentAlerts(); }
  });
  // Restore saved lang on init
  if (displayLang !== 'zh') {
    var langTrigger = langDropdown && langDropdown.querySelector('.dropdown-trigger');
    if (langTrigger) {
      langTrigger.dataset.value = displayLang;
      langTrigger.querySelector('span').textContent = displayLang === 'en' ? 'English' : '中文';
      var langMenu = langDropdown.querySelector('.dropdown-menu');
      if (langMenu) {
        langMenu.querySelectorAll('.dropdown-item').forEach(function (it) {
          it.classList.toggle('active', it.dataset.value === displayLang);
        });
      }
    }
  }

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

  function reloadAi() { aiState.page = 1; loadTrends(); scheduleAnalysis('ai', aiState); }

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

  function reloadGeneral() { generalState.page = 1; loadGeneralTrends(); scheduleAnalysis('general', generalState); }

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
    if (generalTab.classList.contains('active')) {
      triggerAnalysisForTab('general', generalState);
    } else {
      triggerAnalysisForTab('ai', aiState);
    }
    setTimeout(function () { analyzeBtn.disabled = false; }, 10000);
  });

  alertDismiss.addEventListener('click', function () {
    alertBanner.style.display = 'none';
  });

  // === Summary button click delegation ===
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('btn-summary')) {
      var id = parseInt(e.target.dataset.id);
      if (!id) return;
      e.target.textContent = t('generating');
      e.target.disabled = true;
      fetch('/api/trends/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.summaries && data.summaries.length > 0) {
          var el = e.target.closest('.trend-summary');
          if (el) el.innerHTML = esc(data.summaries[0].summary);
        } else {
          e.target.textContent = t('noGenerate');
        }
      })
      .catch(function () {
        e.target.textContent = t('generateFailed');
        e.target.disabled = false;
      });
    }
  });

  // === Socket.IO ===
  socket.on('connect', function () {
    statusEl.textContent = t('connected');
    statusEl.className = 'conn-badge online';
  });

  socket.on('disconnect', function () {
    statusEl.textContent = t('disconnected');
    statusEl.className = 'conn-badge offline';
  });

  socket.on('new-trends', function (data) {
    statusEl.textContent = t('newData') + ' ' + data.items.length + ' ' + t('items');
    statusEl.className = 'conn-badge online';
    if (trendsTab.classList.contains('active')) { loadTrends(); loadSources('ai'); }
    if (generalTab.classList.contains('active')) { loadGeneralTrends(); loadSources('general'); }
  });

  socket.on('fetch-status', function (data) {
    data.results.forEach(function (r) {
      var cls = r.error ? 't-err' : 't-ok';
      var msg = r.error ? t('failed') : r.count + ' ' + t('items');
      showToast('<span class="t-source">' + esc(r.source) + '</span> <span class="' + cls + '">' + msg + '</span>');
    });
    refreshBtn.disabled = false;
  });

  socket.on('analysis-update', function (data) {
    if (data.analysis) {
      if (data.category === 'general') {
        renderAnalysis(data.analysis, 'general');
      } else {
        renderAnalysis(data.analysis);
      }
      analyzeBtn.disabled = false;
    }
  });

  socket.on('keyword-alert', function (data) {
    var count = data.alerts ? data.alerts.length : 0;
    alertText.textContent = '「' + data.keyword + '」' + t('keywordFound') + ' ' + count + ' ' + t('newRelated');
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
    if (diff < 60) return t('justNow');
    if (diff < 3600) return Math.floor(diff / 60) + ' ' + t('minutesAgo');
    if (diff < 86400) return Math.floor(diff / 3600) + ' ' + t('hoursAgo');
    return Math.floor(diff / 86400) + ' ' + t('daysAgo');
  }

  // === Init ===
  applyUILanguage();
  loadTrends();
  loadSources('ai');
  loadAnalysis();
})();
