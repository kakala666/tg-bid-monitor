// 统计页面前端逻辑
let currentGranularity = '1h';
let statsData = null;
let viewsChart = null;
let remainingChart = null;

const COLORS = [
  '#3498db','#e74c3c','#2ecc71','#f39c12',
  '#9b59b6','#1abc9c','#e67e22','#34495e',
];

const GRANULARITIES = [
  { key:'10m', label:'10分钟' },
  { key:'1h',  label:'1小时' },
  { key:'3h',  label:'3小时' },
  { key:'6h',  label:'6小时' },
  { key:'24h', label:'24小时' },
  { key:'7d',  label:'7天' },
  { key:'30d', label:'月' },
];

function init() {
  renderGranularityBtns();
  refreshStats();
}

function renderGranularityBtns() {
  const el = document.getElementById('granBtns');
  el.innerHTML = GRANULARITIES.map(g =>
    `<button class="${g.key === currentGranularity ? 'active' : ''}"
      onclick="setGranularity('${g.key}')">${g.label}</button>`
  ).join('');
}

function setGranularity(key) {
  currentGranularity = key;
  renderGranularityBtns();
  refreshStats();
}

async function refreshStats() {
  const adId = document.getElementById('adFilter').value;
  const url = `/api/stats?granularity=${currentGranularity}` + (adId ? `&adId=${adId}` : '');
  try {
    const res = await fetch(url);
    statsData = await res.json();
    if (statsData.ok) {
      updateAdFilter(statsData.adIds);
      renderCharts(statsData.data);
      renderTable(statsData.data);
    }
  } catch (e) {
    console.error('加载统计数据失败', e);
  }
}

function updateAdFilter(adIds) {
  const sel = document.getElementById('adFilter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">全部广告</option>'
    + adIds.map(id => `<option value="${id}" ${id===cur?'selected':''}>${id}</option>`).join('');
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    interaction: { mode:'index', intersect:false },
    plugins: { legend:{ labels:{ color:'#e0e0e0' } } },
    scales: {
      x: { ticks:{ color:'#888', maxRotation:45, maxTicksLimit:20 }, grid:{ color:'#222' } },
      y: { ticks:{ color:'#888' }, grid:{ color:'#222' },
           title:{ display:true, text:yLabel, color:'#a0c4ff' } },
    },
  };
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  // 24h及以上只显示日期
  if (['24h','7d','30d'].includes(currentGranularity)) return `${mm}-${dd}`;
  return `${mm}-${dd} ${hh}:${mi}`;
}

function renderCharts(data) {
  const adIds = Object.keys(data);
  if (adIds.length === 0) {
    if (viewsChart) { viewsChart.destroy(); viewsChart = null; }
    if (remainingChart) { remainingChart.destroy(); remainingChart = null; }
    return;
  }

  // 收集所有时间标签（取数据点最多的广告）
  let maxAd = adIds[0];
  for (const id of adIds) {
    if (data[id].snapshots.length > data[maxAd].snapshots.length) maxAd = id;
  }
  const labels = data[maxAd].snapshots.map(s => formatTime(s.time));

  // 展示新增量图表
  const viewsDatasets = adIds.map((id, i) => ({
    label: id,
    data: data[id].snapshots.map(s => s.viewsIncr),
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: COLORS[i % COLORS.length] + '33',
    tension: 0.3,
    fill: false,
    pointRadius: 2,
  }));

  if (viewsChart) viewsChart.destroy();
  viewsChart = new Chart(document.getElementById('viewsChart'), {
    type: 'line',
    data: { labels, datasets: viewsDatasets },
    options: chartOptions('展示新增量'),
  });

  // 余额变化图表
  const remDatasets = adIds.map((id, i) => ({
    label: id,
    data: data[id].snapshots.map(s => s.remainingChange),
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: COLORS[i % COLORS.length] + '33',
    tension: 0.3,
    fill: false,
    pointRadius: 2,
  }));

  if (remainingChart) remainingChart.destroy();
  remainingChart = new Chart(document.getElementById('remainingChart'), {
    type: 'line',
    data: { labels, datasets: remDatasets },
    options: chartOptions('余额变化(U)'),
  });
}

function renderTable(data) {
  const tbody = document.getElementById('dataBody');
  tbody.innerHTML = '';
  const rows = [];
  for (const [adId, adData] of Object.entries(data)) {
    for (const s of adData.snapshots) {
      rows.push({ adId, ...s });
    }
  }
  // 按时间倒序
  rows.sort((a, b) => new Date(b.time) - new Date(a.time));
  for (const r of rows) {
    const tr = document.createElement('tr');
    const vc = r.viewsIncr > 0 ? 'positive' : '';
    const rc = r.remainingChange < 0 ? 'negative' : r.remainingChange > 0 ? 'positive' : '';
    tr.innerHTML = `<td>${formatTime(r.time)}</td><td>${r.adId}</td>`
      + `<td class="${vc}">${r.viewsIncr > 0 ? '+' : ''}${r.viewsIncr.toLocaleString()}</td>`
      + `<td class="${rc}">${r.remainingChange > 0 ? '+' : ''}${r.remainingChange}</td>`
      + `<td class="price">${r.currentBid}U</td><td>#${r.rank}</td>`
      + `<td>${r.views.toLocaleString()}</td><td>${r.remaining}U</td>`;
    tbody.appendChild(tr);
  }
}

init();
