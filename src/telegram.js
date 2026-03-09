// Telegram 客户端模块 - 登录、导航Bot、解析排名
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import * as logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import input from 'input';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, '..', 'session.txt');

let client = null;
let botEntity = null;
let lastRankData = null;
let lastRawMessage = '';
let lastMyAdsDetail = [];
let notifyEntity = null;

// 操作锁 - 防止并发操作Bot
let operationLock = false;
let lockQueue = [];

export async function acquireLock(tag = '') {
  if (!operationLock) {
    operationLock = true;
    logger.info(`获取操作锁: ${tag}`);
    return;
  }
  logger.info(`等待操作锁: ${tag}`);
  return new Promise(resolve => {
    lockQueue.push(() => {
      logger.info(`获取操作锁: ${tag}`);
      resolve();
    });
  });
}

export function releaseLock(tag = '') {
  if (lockQueue.length > 0) {
    const next = lockQueue.shift();
    next();
  } else {
    operationLock = false;
  }
  logger.info(`释放操作锁: ${tag}`);
}

export function isLocked() { return operationLock; }

export function getClient() { return client; }
export function getLastRankData() { return lastRankData; }
export function getLastRawMessage() { return lastRawMessage; }
export function getLastMyAdsDetail() { return lastMyAdsDetail; }

// 初始化并登录
export async function initClient(apiId, apiHash, phone) {
  const sessionStr = fs.existsSync(SESSION_FILE)
    ? fs.readFileSync(SESSION_FILE, 'utf-8').trim()
    : '';
  const session = new StringSession(sessionStr);

  client = new TelegramClient(session, Number(apiId), apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => phone,
    phoneCode: async () => {
      logger.info('等待输入验证码...');
      return await input.text('请输入Telegram验证码: ');
    },
    password: async () => {
      return await input.text('请输入两步验证密码: ');
    },
    onError: (err) => logger.error('登录错误', err.message),
  });

  // 保存session
  const saved = client.session.save();
  fs.writeFileSync(SESSION_FILE, saved);
  logger.info('Telegram登录成功，session已保存');
  return client;
}

// 解析Bot实体
export async function resolveBot(botUsername) {
  botEntity = await client.getEntity(botUsername);
  logger.info(`已解析Bot: ${botUsername}`, { id: botEntity.id.toString() });
  return botEntity;
}

// 发送命令给Bot（智能等待回复）
export async function sendCommand(command) {
  logger.action(`发送命令: ${command}`);
  const before = await getLatestBotMessage();
  const prevId = before ? before.id : 0;
  const prevText = before ? (before.raw.text || before.raw.message || '') : '';
  await client.sendMessage(botEntity, { message: command });
  await waitForBotUpdate(prevId, prevText);
}

// 等待Bot回复并获取最新消息(含内联按钮)
// 注意：过滤掉自己发的消息(msg.out)，只取Bot的回复
export async function getLatestBotMessage() {
  const messages = await client.getMessages(botEntity, { limit: 10 });
  const msg = messages.find(m => !m.out);
  if (!msg) return null;
  return {
    id: msg.id,
    text: msg.text || msg.message || '',
    buttons: extractButtons(msg),
    raw: msg,
  };
}

// 提取内联按钮
function extractButtons(msg) {
  const buttons = [];
  if (!msg.replyMarkup || !msg.replyMarkup.rows) return buttons;
  for (const row of msg.replyMarkup.rows) {
    const rowBtns = [];
    for (const btn of row.buttons) {
      rowBtns.push({
        text: btn.text,
        data: btn.data ? btn.data.toString('utf-8') : null,
      });
    }
    buttons.push(rowBtns);
  }
  return buttons;
}

// 点击内联按钮(通过按钮文本匹配，智能等待回复)
export async function clickButton(buttonText) {
  const msg = await getLatestBotMessage();
  if (!msg) {
    logger.error('没有找到Bot消息');
    return false;
  }
  for (const row of msg.buttons) {
    for (const btn of row) {
      if (btn.text.includes(buttonText)) {
        logger.action(`点击按钮: "${btn.text}"`);
        const prevId = msg.id;
        const prevText = msg.raw.text || msg.raw.message || '';
        await msg.raw.click({ text: btn.text });
        await waitForBotUpdate(prevId, prevText);
        return true;
      }
    }
  }
  logger.warn(`未找到按钮: "${buttonText}"`);
  return false;
}

// 点击指定行列的按钮（智能等待回复）
export async function clickButtonAt(rowIdx, colIdx) {
  const msg = await getLatestBotMessage();
  if (!msg || !msg.buttons[rowIdx] || !msg.buttons[rowIdx][colIdx]) {
    logger.error(`按钮位置无效: [${rowIdx}][${colIdx}]`);
    return false;
  }
  const btn = msg.buttons[rowIdx][colIdx];
  logger.action(`点击按钮[${rowIdx}][${colIdx}]: "${btn.text}"`);
  const prevId = msg.id;
  const prevText = msg.raw.text || msg.raw.message || '';
  await msg.raw.click({ text: btn.text });
  await waitForBotUpdate(prevId, prevText);
  return true;
}

// 解析排名文本 - 适配 sx2026bot 格式
// 格式示例:
//   ⬜️3|广告AD2430|82***9183|**218U**|14天后
//   **☑️2|广告AD2458|897993054|219U**|不足1天
export function parseRankings(text) {
  lastRawMessage = text;
  const lines = text.split('\n');
  const rankings = [];
  for (const line of lines) {
    // 匹配: 可选**和☑️/⬜️ + 排名数字 + 可选emoji + |广告ADXXX|用户ID|价格U
    const match = line.match(
      /[*]*[☑⬜️\s]*(\d+)[🔥🏆]*\|(广告AD\d+)\|([^|]+)\|\**(\d+)U/
    );
    if (match) {
      const isMine = line.includes('☑');
      rankings.push({
        rank: parseInt(match[1]),
        adId: match[2],
        userId: match[3].trim(),
        price: parseInt(match[4]),
        isMine,
        raw: line.trim(),
      });
    }
  }
  lastRankData = rankings;
  return rankings;
}

// 完整导航流程：/start → 广告中心 → 正在投放
export async function navigateToRankings() {
  logger.info('开始导航到排名页面...');
  await sendCommand('/start');

  const clicked1 = await clickButton('广告中心');
  if (!clicked1) {
    logger.error('未找到"广告中心"按钮');
    return null;
  }

  const clicked2 = await clickButton('正在投放');
  if (!clicked2) {
    logger.error('未找到"正在投放"按钮');
    return null;
  }

  const msg = await getLatestBotMessage();
  if (!msg) {
    logger.error('获取排名页面失败');
    return null;
  }

  logger.info('成功获取排名页面');
  const rankings = parseRankings(msg.text);
  logger.info(`解析到 ${rankings.length} 条排名数据`, rankings);
  return { text: msg.text, rankings, buttons: msg.buttons };
}

// 刷新排名：点返回 → 重新点"正在投放"
export async function refreshRankings() {
  logger.info('刷新排名数据...');
  // 实际按钮文本是 "🔙返回"
  const clickedBack = await clickButton('返回');

  if (!clickedBack) {
    logger.warn('未找到返回按钮，尝试完整导航');
    return await navigateToRankings();
  }

  const clicked = await clickButton('正在投放');
  if (!clicked) {
    logger.warn('刷新失败，尝试完整导航');
    return await navigateToRankings();
  }

  const msg = await getLatestBotMessage();
  if (!msg) {
    logger.error('刷新后获取消息失败');
    return null;
  }

  const rankings = parseRankings(msg.text);
  logger.info(`刷新完成，解析到 ${rankings.length} 条排名`, rankings);
  return { text: msg.text, rankings, buttons: msg.buttons };
}

// 获取当前消息的所有按钮信息（用于调试）
export async function dumpButtons() {
  const msg = await getLatestBotMessage();
  if (!msg) return { text: '', buttons: [] };
  return { text: msg.text, buttons: msg.buttons };
}

// 解析广告详情页文本
export function parseAdDetail(text) {
  const detail = {};
  // 广告ID
  const idMatch = text.match(/广告(AD\d+)/);
  if (idMatch) detail.adId = idMatch[1];
  // 展示次数
  const viewMatch = text.match(/展示次数[：:]\s*([\d,]+)/);
  if (viewMatch) detail.views = parseInt(viewMatch[1].replace(/,/g, ''));
  // 广告状态
  const statusMatch = text.match(/广告状态[：:]\s*\**([^*\n]+)/);
  if (statusMatch) detail.status = statusMatch[1].trim();
  // 单日竞价
  const bidMatch = text.match(/单日展示竞价[：:]\s*\**(\d+)\**/);
  if (bidMatch) detail.currentBid = parseInt(bidMatch[1]);
  // 投放总金额
  const totalMatch = text.match(/投放总金额[：:]\s*([\d.]+)/);
  if (totalMatch) detail.totalBudget = parseFloat(totalMatch[1]);
  // 剩余金额
  const remainMatch = text.match(/剩余金额[：:]\s*([\d.]+)/);
  if (remainMatch) detail.remaining = parseFloat(remainMatch[1]);
  // 广告预览文本
  const previewMatch = text.match(/预览[：:]\s*_*(.+?)_*\s*$/m);
  if (previewMatch) detail.preview = previewMatch[1].trim();
  detail.rawText = text;
  return detail;
}

// 从排名页匹配"我的"广告和对应按钮
export function matchMyAdsWithButtons(rankings, buttons) {
  const myAds = rankings.filter(r => r.isMine);
  const matched = [];
  for (const ad of myAds) {
    // 广告ID如 "AD2458"，按钮文本如 "🚀广告AD2458"
    const adNum = ad.adId.replace('广告', ''); // "AD2458"
    let foundBtn = null;
    let btnRow = -1, btnCol = -1;
    for (let ri = 0; ri < buttons.length; ri++) {
      for (let ci = 0; ci < buttons[ri].length; ci++) {
        if (buttons[ri][ci].text.includes(adNum) && !buttons[ri][ci].text.includes('取消')) {
          foundBtn = buttons[ri][ci];
          btnRow = ri;
          btnCol = ci;
          break;
        }
      }
      if (foundBtn) break;
    }
    matched.push({
      ...ad,
      button: foundBtn,
      btnRow,
      btnCol,
      hasButton: !!foundBtn,
    });
  }
  return matched;
}

// 获取单个广告的详情（点击按钮 → 解析 → 返回列表）
export async function fetchAdDetail(buttonText) {
  logger.action(`进入广告详情: ${buttonText}`);
  const clicked = await clickButton(buttonText);
  if (!clicked) {
    logger.error(`点击广告按钮失败: ${buttonText}`);
    return null;
  }

  const msg = await getLatestBotMessage();
  if (!msg) {
    logger.error('获取广告详情失败');
    return null;
  }

  const detail = parseAdDetail(msg.text);
  detail.buttons = msg.buttons;
  logger.info(`广告 ${detail.adId || buttonText} 详情已获取`, {
    bid: detail.currentBid,
    remaining: detail.remaining,
  });

  // 点返回回到列表
  await clickButton('返回');
  return detail;
}

// 批量获取所有"我的"广告详情
export async function fetchAllMyAdsDetail() {
  const rankings = getLastRankData();
  if (!rankings || rankings.length === 0) {
    logger.warn('没有排名数据，请先刷新排名');
    return [];
  }

  const msg = await getLatestBotMessage();
  const buttons = msg ? msg.buttons : [];
  const matched = matchMyAdsWithButtons(rankings, buttons);

  logger.info(`找到 ${matched.length} 个我的广告，开始逐个获取详情`);
  const details = [];
  for (const ad of matched) {
    if (!ad.hasButton) {
      logger.warn(`广告 ${ad.adId} 无匹配按钮，跳过`);
      continue;
    }
    const detail = await fetchAdDetail(ad.button.text);
    if (detail) {
      detail.rank = ad.rank;
      detail.rankPrice = ad.price;
      details.push(detail);
    }
  }
  lastMyAdsDetail = details;
  logger.info(`所有广告详情获取完成，共 ${details.length} 个`);
  return details;
}

// 修改单个广告的竞价价格
// 前置条件：当前必须在"正在投放"列表页
// 流程：点广告按钮 → 详情页 → 点"修改单日竞价" → 发送价格 → 确认 → 返回详情 → 返回列表
export async function changeBidPrice(adButtonText, newPrice) {
  logger.action(`开始修改竞价: ${adButtonText} → ${newPrice}U`);

  // 1. 点广告按钮进入详情
  const clicked1 = await clickButton(adButtonText);
  if (!clicked1) {
    logger.error(`点击广告按钮失败: ${adButtonText}`);
    return { success: false, error: '点击广告按钮失败' };
  }

  // 2. 点"修改单日竞价"
  const clicked2 = await clickButton('修改单日竞价');
  if (!clicked2) {
    logger.error('未找到"修改单日竞价"按钮');
    await clickButton('返回');
    return { success: false, error: '未找到修改单日竞价按钮' };
  }

  // 3. 发送新价格（智能等待Bot确认）
  const beforeMsg = await getLatestBotMessage();
  logger.action(`发送新价格: ${newPrice}`);
  await client.sendMessage(botEntity, { message: String(newPrice) });
  await waitForBotUpdate(
    beforeMsg ? beforeMsg.id : 0,
    beforeMsg ? (beforeMsg.raw.text || beforeMsg.raw.message || '') : ''
  );

  // 4. 检查确认消息
  const msg = await getLatestBotMessage();
  const confirmText = msg ? msg.text : '';
  const isConfirmed = confirmText.includes('已修改') || confirmText.includes('竞价');
  if (isConfirmed) {
    logger.info(`竞价修改成功: ${confirmText.split('\n')[0]}`);
  } else {
    logger.warn(`竞价修改结果不确定，Bot回复: ${confirmText.slice(0, 100)}`);
  }

  // 5-6. 返回列表
  await clickButton('返回');
  await clickButton('返回');

  return {
    success: isConfirmed,
    confirmText: confirmText.split('\n')[0],
    newPrice,
  };
}

// 根据广告ID在列表页找到对应按钮文本
export function findAdButton(adId, buttons) {
  const adNum = adId.replace('广告', '');
  for (const row of buttons) {
    for (const btn of row) {
      if (btn.text.includes(adNum) && !btn.text.includes('取消')) {
        return btn.text;
      }
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 智能等待Bot回复（替代固定sleep）
// 轮询检测消息变化：新消息ID 或 内容被编辑
// 关键：只检测Bot发的消息(!m.out)，忽略自己发的消息
async function waitForBotUpdate(prevMsgId, prevText, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await sleep(150);
    try {
      const messages = await client.getMessages(botEntity, { limit: 10 });
      const msg = messages.find(m => !m.out);
      if (msg) {
        const curText = msg.text || msg.message || '';
        if (msg.id !== prevMsgId || curText !== prevText) {
          await sleep(200); // 短暂稳定延迟
          return true;
        }
      }
    } catch (e) { /* 忽略轮询异常 */ }
  }
  logger.warn(`等待Bot回复超时(${timeout}ms)`);
  return false;
}

// 解析通知群组实体（带缓存）
export async function resolveNotifyGroup(groupId) {
  if (!groupId || !client) return null;
  try {
    // 数字ID转为Number
    const entity = /^-?\d+$/.test(String(groupId))
      ? await client.getEntity(Number(groupId))
      : await client.getEntity(groupId);
    notifyEntity = entity;
    logger.info(`通知群组已解析: ${groupId}`);
    return entity;
  } catch (e) {
    logger.error(`解析通知群组失败: ${groupId}`, e.message);
    notifyEntity = null;
    return null;
  }
}

// 向通知群组发送消息
export async function sendNotify(text) {
  if (!notifyEntity || !client) return false;
  try {
    await client.sendMessage(notifyEntity, { message: text, parseMode: 'md' });
    return true;
  } catch (e) {
    logger.error('发送通知失败', e.message);
    return false;
  }
}
