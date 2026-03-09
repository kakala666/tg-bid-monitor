// 前端逻辑
let ws = null;
let config = {};

// WebSocket连接
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    document.getElementById('connStatus').className = 'dot green';
    document.getElementById('connText').textContent = '已连接';
  };

  ws.onclose = () => {
    document.getElementById('connStatus').className = 'dot red';
    document.getElementById('connText').textContent = '未连接';
    setTimeout(connectWS, 3000);
  };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    switch (msg.type) {
      case 'log': appendLog(msg.data); break;
      case 'rankings': updateRankings(msg.data); break;
      case 'status': updateStatus(msg.data); break;
      case 'config': config = msg.data; renderConfig(); break;
      case 'suggestions': renderSuggestions(msg.data); break;
      case 'bidResult': onBidResult(msg.data); break;
    }
  };
}

// 日志
function appendLog(entry) {
  const el = document.getElementById('logContainer');
  const div = document.createElement('div');
  div.className = `log-entry ${entry.level}`;
  const t = new Date(entry.time).toLocaleTimeString();
  div.innerHTML = `<span class="time">${t}</span> <span class="level">[${entry.level}]</span> ${escHtml(entry.message)}`;
  if (entry.data) {
    const detail = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
    div.innerHTML += ` <span style="color:#666">${escHtml(detail).slice(0, 200)}</span>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function clearLogs() {
  document.getElementById('logContainer').innerHTML = '';
}

// 排名更新
function updateRankings(data) {
  document.getElementById('rankTime').textContent = new Date().toLocaleTimeString();
  document.getElementById('rankRaw').textContent = data.text || '';
  const tbody = document.getElementById('rankBody');
  tbody.innerHTML = '';
  if (data.rankings) {
    data.rankings.forEach(r => {
      const tr = document.createElement('tr');
      if (r.isMine) tr.style.background = '#1a3a2a';
      tr.innerHTML = `<td>${r.rank}</td><td>${escHtml(r.adId)}</td><td>${escHtml(r.userId)}</td><td class="price">${r.price}</td><td>${r.isMine ? '☑️我的' : ''}</td>`;
      tbody.appendChild(tr);
    });
  }
}

// 状态更新
function updateStatus(data) {
  const el = document.getElementById('monitorStatus');
  el.textContent = data.monitoring ? '监控运行中' : '监控已停止';
  el.style.color = data.monitoring ? '#2ecc71' : '#e74c3c';
}

// API调用
async function api(url, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (data.rankings) updateRankings(data);
    if (data.strategy) renderSuggestions(data.strategy);
    return data;
  } catch (e) {
    appendLog({ level: 'ERROR', message: `API错误: ${e.message}`, time: new Date().toISOString() });
  }
}

// 竞价建议渲染
function renderSuggestions(data) {
  document.getElementById('sugTime').textContent = new Date().toLocaleTimeString();
  const infoEl = document.getElementById('sugInfo');
  const bidOn = config.autoBidEnabled;
  infoEl.innerHTML = bidOn
    ? '<span style="color:#2ecc71">● 竞价已开启</span>'
    : '<span style="color:#e74c3c">● 竞价已关闭（仅监控）</span>';

  const el = document.getElementById('sugContainer');
  if (!data.suggestions || data.suggestions.length === 0) {
    el.innerHTML = '<p style="color:#888">暂无建议（排名中没有我的广告或未刷新）</p>';
    return;
  }
  el.innerHTML = data.suggestions.map(s => {
    const colorMap = { KEEP: '#888', RAISE: '#e74c3c', LOWER: '#2ecc71', SKIP: '#f39c12' };
    const iconMap = { KEEP: '⏸', RAISE: '⬆️', LOWER: '⬇️', SKIP: '⏭️' };
    const color = colorMap[s.action] || '#888';
    const icon = iconMap[s.action] || '?';
    const noteTag = s.note ? `(${escHtml(s.note)})` : '';
    if (s.action === 'SKIP') {
      return `<div class="sug-card" style="border-left-color:${color};opacity:0.7;background:#1a1500">
        <div class="sug-header">
          <span>${icon} <strong>${s.adId}</strong>${noteTag}</span>
          <span>排名 #${s.rank}</span>
          <span style="color:${color};font-weight:bold">未配置</span>
        </div>
        <div class="sug-prices"><span>当前: <strong>${s.currentPrice}U</strong></span></div>
        <div class="sug-reason" style="color:${color}">${escHtml(s.reason)}</div>
      </div>`;
    }
    const changed = s.action !== 'KEEP';
    const applyBtn = (changed && config.autoBidEnabled)
      ? `<button class="small" style="margin-left:auto;background:${color}" onclick="applyBid('${escHtml(s.adId)}',${s.targetPrice})">应用 ${s.targetPrice}U</button>`
      : '';
    return `<div class="sug-card" style="border-left-color:${color}">
      <div class="sug-header">
        <span>${icon} <strong>${s.adId}</strong>${noteTag}</span>
        <span>排名 #${s.rank}</span>
        <span style="color:${color};font-weight:bold">${s.action}</span>
        <span style="color:#888;font-size:0.78rem">预算${s.budgetLimit}U | 阈值${s.gapThreshold}U | 排名上限${s.rankLimit != null ? '#' + s.rankLimit : '无'}</span>
        ${applyBtn}
      </div>
      <div class="sug-prices">
        <span>当前: <strong>${s.currentPrice}U</strong></span>
        <span style="font-size:1.2em">${changed ? '→' : '='}</span>
        <span style="color:${color}">建议: <strong>${s.targetPrice}U</strong></span>
        ${changed ? `<span class="sug-diff">(${s.action === 'RAISE' ? '+' : ''}${s.targetPrice - s.currentPrice}U)</span>` : ''}
      </div>
      <div class="sug-reason">${escHtml(s.reason)}</div>
    </div>`;
  }).join('');
}

async function applyBid(adId, price) {
  if (!confirm(`确认将 ${adId} 竞价改为 ${price}U？`)) return;
  appendLog({ level: 'ACTION', message: `正在修改 ${adId} → ${price}U...`, time: new Date().toISOString() });
  const res = await api('/api/bid', 'POST', { adId, price });
  if (res && res.success) {
    appendLog({ level: 'INFO', message: `修改成功: ${res.confirmText}`, time: new Date().toISOString() });
  } else {
    appendLog({ level: 'ERROR', message: `修改失败: ${res?.error || res?.confirmText || '未知错误'}`, time: new Date().toISOString() });
  }
}

function onBidResult(data) {
  const level = data.success ? 'ACTION' : 'ERROR';
  const msg = data.success
    ? `自动改价成功: ${data.adId} → ${data.newPrice}U | ${data.confirmText}`
    : `自动改价失败: ${data.adId} | ${data.error || data.confirmText}`;
  appendLog({ level, message: msg, time: new Date().toISOString() });
}

// 配置渲染
function renderConfig() {
  const form = document.getElementById('configForm');
  form.innerHTML = '';
  // 基础配置
  form.innerHTML += label('Bot用户名', input('cfg_bot', config.botUsername || ''));
  form.innerHTML += label('默认检查间隔(秒)', input('cfg_interval', config.checkInterval || 10, 'number') +
    '<small style="color:#888;margin-left:8px">无时段匹配时使用</small>');
  form.innerHTML += '<h3>轮询间隔时段 <small style="color:#888">不同时段使用不同轮询间隔，未匹配时用默认值</small></h3>';
  form.innerHTML += '<div id="intervalSlotsContainer"></div>';
  form.innerHTML += '<button class="small" onclick="addIntervalSlot()">+ 添加轮询时段</button>';
  renderIntervalSlots();
  form.innerHTML += label('竞价总开关', `<select id="cfg_autobid">
    <option value="false" ${!config.autoBidEnabled ? 'selected' : ''}>关闭(仅监控)</option>
    <option value="true" ${config.autoBidEnabled ? 'selected' : ''}>开启(可改价)</option></select>`);
  form.innerHTML += label('通知开关', `<select id="cfg_enableNotify">
    <option value="false" ${!config.enableNotify ? 'selected' : ''}>关闭</option>
    <option value="true" ${config.enableNotify ? 'selected' : ''}>开启</option></select>`);
  form.innerHTML += label('通知群组', input('cfg_notifyGroupId', config.notifyGroupId || '') +
    '<small style="color:#888;margin-left:8px">填群组用户名或数字Chat ID</small>');

  // 每个广告的独立配置
  form.innerHTML += '<h3>广告独立配置 <small style="color:#f39c12">* 未配置的广告不会参与竞价</small></h3>';
  form.innerHTML += '<div id="adConfigsContainer"></div>';
  form.innerHTML += '<button class="small" onclick="addAdConfig()">+ 添加广告配置</button>';
  renderAdConfigs();
}

function renderIntervalSlots() {
  const sc = document.getElementById('intervalSlotsContainer');
  if (!sc) return;
  sc.innerHTML = '';
  const slots = config.checkIntervalSlots || [];
  slots.forEach((s, i) => {
    sc.innerHTML += `<div class="slot">
      <input id="intv_s_${i}" value="${s.start}" placeholder="开始" style="width:60px">-
      <input id="intv_e_${i}" value="${s.end}" placeholder="结束" style="width:60px">
      间隔:<input id="intv_v_${i}" value="${s.interval}" type="number" style="width:50px">秒
      <button class="small" onclick="removeIntervalSlot(${i})">删除</button></div>`;
  });
}

function addIntervalSlot() {
  config.checkIntervalSlots = config.checkIntervalSlots || [];
  config.checkIntervalSlots.push({ start: '00:00', end: '24:00', interval: 10 });
  renderConfig();
}

function removeIntervalSlot(idx) {
  config.checkIntervalSlots = config.checkIntervalSlots || [];
  config.checkIntervalSlots.splice(idx, 1);
  renderConfig();
}

function collectIntervalSlots() {
  const slots = [];
  let i = 0;
  while (document.getElementById(`intv_s_${i}`)) {
    slots.push({
      start: document.getElementById(`intv_s_${i}`).value,
      end: document.getElementById(`intv_e_${i}`).value,
      interval: Number(document.getElementById(`intv_v_${i}`).value),
    });
    i++;
  }
  return slots;
}

function renderSlots(containerId, slots, prefix) {
  const sc = document.getElementById(containerId);
  if (!sc) return;
  sc.innerHTML = '';
  slots.forEach((s, i) => {
    const rlVal = s.rankLimit != null ? s.rankLimit : '';
    sc.innerHTML += `<div class="slot">
      <input id="${prefix}_s_${i}" value="${s.start}" placeholder="开始" style="width:60px">-
      <input id="${prefix}_e_${i}" value="${s.end}" placeholder="结束" style="width:60px">
      预算:<input id="${prefix}_b_${i}" value="${s.budgetLimit}" type="number" style="width:60px">U
      排名上限:<input id="${prefix}_r_${i}" value="${rlVal}" type="number" min="1" max="10" style="width:50px" placeholder="默认">
      <button class="small" onclick="removeSlot('${prefix}',${i})">删除</button></div>`;
  });
}

function renderAdConfigs() {
  const container = document.getElementById('adConfigsContainer');
  if (!container) return;
  container.innerHTML = '';
  const adConfigs = config.adConfigs || {};
  const adKeys = Object.keys(adConfigs);
  adKeys.forEach((adKey, idx) => {
    const ac = adConfigs[adKey];
    container.innerHTML += `<div class="ad-config-block" id="adcfg_${idx}">
      <div class="ad-config-header">
        <strong style="color:#a0c4ff">广告${adKey}</strong>
        <input id="adkey_${idx}" value="${adKey}" style="width:80px" placeholder="如AD2458">
        备注:<input id="adnote_${idx}" value="${ac.note || ''}" style="width:80px" placeholder="选填">
        降价阈值:<input id="adgap_${idx}" value="${ac.priceGapThreshold != null ? ac.priceGapThreshold : ''}" type="number" style="width:50px" placeholder="必填">
        默认排名上限:<input id="adrank_${idx}" value="${ac.rankLimit != null ? ac.rankLimit : ''}" type="number" min="1" max="10" style="width:50px" placeholder="不限" title="时段未配置排名上限时的回退值">
        <button class="small" onclick="removeAdConfig(${idx})">删除</button>
      </div>
      <div id="adslots_${idx}"></div>
      <button class="small" onclick="addSlot('ad_${idx}')">+ 添加时段</button>
    </div>`;
  });
  // 渲染每个广告的时段
  adKeys.forEach((adKey, idx) => {
    const ac = adConfigs[adKey];
    renderSlots(`adslots_${idx}`, ac.timeSlots || [], `ad_${idx}`);
  });
}

function addSlot(prefix) {
  // prefix = "ad_0", "ad_1"...
  const idx = parseInt(prefix.split('_')[1]);
  const adKey = Object.keys(config.adConfigs || {})[idx];
  if (adKey) {
    config.adConfigs[adKey].timeSlots = config.adConfigs[adKey].timeSlots || [];
    config.adConfigs[adKey].timeSlots.push({ start: '00:00', end: '00:00', budgetLimit: 50, rankLimit: null });
  }
  renderConfig();
}

function removeSlot(prefix, slotIdx) {
  const idx = parseInt(prefix.split('_')[1]);
  const adKey = Object.keys(config.adConfigs || {})[idx];
  if (adKey) config.adConfigs[adKey].timeSlots.splice(slotIdx, 1);
  renderConfig();
}

function addAdConfig() {
  config.adConfigs = config.adConfigs || {};
  const newKey = prompt('输入广告ID（如 AD2458）：');
  if (!newKey) return;
  config.adConfigs[newKey.toUpperCase()] = { note: '', priceGapThreshold: 5, rankLimit: null, timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 50, rankLimit: null }] };
  renderConfig();
}

function removeAdConfig(idx) {
  const adKey = Object.keys(config.adConfigs || {})[idx];
  if (adKey) delete config.adConfigs[adKey];
  renderConfig();
}

function collectSlots(prefix, count) {
  const slots = [];
  let i = 0;
  while (document.getElementById(`${prefix}_s_${i}`)) {
    const rlEl = document.getElementById(`${prefix}_r_${i}`);
    const rlVal = rlEl && rlEl.value !== '' ? Number(rlEl.value) : null;
    slots.push({
      start: document.getElementById(`${prefix}_s_${i}`).value,
      end: document.getElementById(`${prefix}_e_${i}`).value,
      budgetLimit: Number(document.getElementById(`${prefix}_b_${i}`).value),
      rankLimit: rlVal,
    });
    i++;
  }
  return slots;
}

function saveConfig() {
  config.botUsername = document.getElementById('cfg_bot').value;
  config.checkInterval = Number(document.getElementById('cfg_interval').value);
  config.checkIntervalSlots = collectIntervalSlots();
  config.autoBidEnabled = document.getElementById('cfg_autobid').value === 'true';
  config.enableNotify = document.getElementById('cfg_enableNotify').value === 'true';
  config.notifyGroupId = document.getElementById('cfg_notifyGroupId').value.trim();
  // 清除旧的全局字段（如果还残留）
  delete config.defaultPriceGapThreshold;
  delete config.defaultTimeSlots;

  // 收集每个广告的独立配置
  const oldKeys = Object.keys(config.adConfigs || {});
  const newAdConfigs = {};
  oldKeys.forEach((_, idx) => {
    const keyEl = document.getElementById(`adkey_${idx}`);
    const gapEl = document.getElementById(`adgap_${idx}`);
    const rankEl = document.getElementById(`adrank_${idx}`);
    if (!keyEl) return;
    const key = keyEl.value.toUpperCase();
    const noteEl = document.getElementById(`adnote_${idx}`);
    const noteVal = noteEl ? noteEl.value.trim() : '';
    const gapVal = gapEl.value !== '' ? Number(gapEl.value) : null;
    const rankVal = rankEl && rankEl.value !== '' ? Number(rankEl.value) : null;
    const slots = collectSlots(`ad_${idx}`);
    newAdConfigs[key] = { note: noteVal, priceGapThreshold: gapVal, rankLimit: rankVal, timeSlots: slots };
  });
  config.adConfigs = newAdConfigs;

  // 保存前校验：检查每个广告是否有完整配置
  const warnings = [];
  for (const [key, cfg] of Object.entries(newAdConfigs)) {
    if (!cfg.timeSlots || cfg.timeSlots.length === 0) {
      warnings.push(`广告 ${key} 没有配置时段，不会参与竞价`);
    }
    if (cfg.priceGapThreshold == null) {
      warnings.push(`广告 ${key} 没有配置降价阈值`);
    }
  }
  if (warnings.length > 0) {
    if (!confirm('配置警告：\n' + warnings.join('\n') + '\n\n是否继续保存？')) return;
  }

  api('/api/config', 'POST', config);
}

// 获取我的广告详情
async function fetchMyAds() {
  document.getElementById('myAdsContainer').innerHTML = '<p style="color:#888">正在逐个获取广告详情，请稍候...</p>';
  const res = await api('/api/myads', 'POST');
  if (res && res.details) renderMyAds(res.details);
}

function renderMyAds(details) {
  const el = document.getElementById('myAdsContainer');
  document.getElementById('myAdsTime').textContent = new Date().toLocaleTimeString();
  if (!details || details.length === 0) {
    el.innerHTML = '<p style="color:#888">没有找到我的广告</p>';
    return;
  }
  el.innerHTML = details.map(d => `
    <div class="ad-card">
      <div class="ad-header">
        <span class="ad-id">广告${d.adId || '?'}</span>
        <span class="ad-rank">排名 #${d.rank || '?'}</span>
        <span class="ad-status">${escHtml(d.status || '未知')}</span>
      </div>
      <div class="ad-body">
        <div class="ad-field"><span>单日竞价</span><strong class="price">${d.currentBid || '?'} U</strong></div>
        <div class="ad-field"><span>排名价格</span><strong>${d.rankPrice || '?'} U</strong></div>
        <div class="ad-field"><span>展示次数</span><strong>${(d.views || 0).toLocaleString()}</strong></div>
        <div class="ad-field"><span>剩余金额</span><strong>${d.remaining || '?'} U</strong></div>
        <div class="ad-field"><span>投放总额</span><strong>${d.totalBudget || '?'} U</strong></div>
      </div>
      ${d.preview ? `<div class="ad-preview">${escHtml(d.preview)}</div>` : ''}
    </div>
  `).join('');
}

// 调试工具
async function debugClick() {
  const text = document.getElementById('debugInput').value;
  if (!text) return;
  const res = await api('/api/click', 'POST', { text });
  if (res && res.message) {
    document.getElementById('rankRaw').textContent = res.message.text || '';
    appendLog({ level: 'INFO', message: `按钮响应: ${(res.message.text || '').slice(0, 100)}`, time: new Date().toISOString() });
  }
}

async function debugSend() {
  const text = document.getElementById('debugInput').value;
  if (!text) return;
  const res = await api('/api/send', 'POST', { text });
  if (res && res.message) {
    document.getElementById('rankRaw').textContent = res.message.text || '';
  }
}

async function debugDump() {
  const res = await api('/api/dump');
  if (res) {
    document.getElementById('rankRaw').textContent =
      `=== 消息文本 ===\n${res.text}\n\n=== 按钮 ===\n${JSON.stringify(res.buttons, null, 2)}`;
  }
}

// 工具函数
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function label(text, inputHtml) {
  return `<label><span>${text}</span>${inputHtml}</label>`;
}
function input(id, value, type = 'text') {
  return `<input id="${id}" type="${type}" value="${escHtml(String(value))}">`;
}

// 初始化
async function init() {
  connectWS();
  const res = await fetch('/api/config');
  config = await res.json();
  renderConfig();
}
init();
