import { getAiConfig } from './aiConfig';
import { translateExpr, ACTION_LABELS, VAR_LABELS } from '../components/strategy/i18n';

// 将流程图转为文本描述，便于 AI 理解
function flowToText(nodes, edges) {
  const lines = [];

  for (const n of nodes) {
    const d = n.data;
    if (d.type === 'start') {
      lines.push(`[${d.id}] 开始节点`);
    } else if (d.type === 'condition') {
      lines.push(`[${d.id}] 条件判断: ${translateExpr(d.expr) || '(空)'}`);
    } else if (d.type === 'action') {
      const label = ACTION_LABELS[d.action] || d.action;
      const target = d.targetExpr ? `，目标价 = ${translateExpr(d.targetExpr)}` : '';
      lines.push(`[${d.id}] 执行动作: ${label}${target}`);
    } else if (d.type === 'setVar') {
      const varLabel = VAR_LABELS[d.varName] || d.varName;
      lines.push(`[${d.id}] 设置变量: ${varLabel} = ${translateExpr(d.expr) || '?'}`);
    } else if (d.type === 'template') {
      lines.push(`[${d.id}] 引用模板: ${d.templateId || '(未选择)'}`);
    }
  }

  lines.push('');
  lines.push('连接关系:');
  for (const e of edges) {
    const branch = e.sourceHandle === 'yes' ? '(是)' : e.sourceHandle === 'no' ? '(否)' : '';
    lines.push(`  ${e.source} → ${e.target} ${branch}`);
  }

  return lines.join('\n');
}

// 将引擎格式的图转为中文摘要（用于弹窗展示）
export function describeGraph(graph) {
  if (!graph || !graph.nodes) return '(空策略)';
  const counts = { condition: 0, action: 0, setVar: 0, template: 0 };
  const actions = [];
  for (const n of graph.nodes) {
    if (counts[n.type] !== undefined) counts[n.type]++;
    if (n.type === 'action' && !actions.includes(n.action)) actions.push(n.action);
  }
  const actionLabels = actions.map((a) => ACTION_LABELS[a] || a).join('、');
  const parts = [
    `${graph.nodes.length} 个节点，${(graph.edges || []).length} 条边`,
    `${counts.condition} 个条件判断`,
    `${counts.action} 个动作（${actionLabels || '无'}）`,
  ];
  if (counts.setVar > 0) parts.push(`${counts.setVar} 个变量计算`);
  if (counts.template > 0) parts.push(`${counts.template} 个模板引用`);
  return parts.join('，');
}

// 将引擎格式的图转为文本（用于生成/修改时发送当前策略给 AI）
function engineGraphToText(graph) {
  if (!graph || !graph.nodes) return '(空策略)';
  const lines = [];
  for (const n of graph.nodes) {
    if (n.type === 'start') {
      lines.push(`[${n.id}] 开始节点`);
    } else if (n.type === 'condition') {
      lines.push(`[${n.id}] 条件: ${n.expr || '(空)'}`);
    } else if (n.type === 'action') {
      const target = n.targetExpr ? `，目标价 = ${n.targetExpr}` : '';
      lines.push(`[${n.id}] 动作: ${n.action}${target}`);
    } else if (n.type === 'setVar') {
      lines.push(`[${n.id}] 变量: ${n.varName} = ${n.expr || '?'}`);
    } else if (n.type === 'template') {
      lines.push(`[${n.id}] 模板: ${n.templateId}`);
    }
  }
  lines.push('连接:');
  for (const e of graph.edges || []) {
    const branch = e.branch ? `(${e.branch})` : '';
    lines.push(`  ${e.from} → ${e.to} ${branch}`);
  }
  return lines.join('\n');
}

async function callAi(messages, { temperature = 0.3, maxTokens = 2000 } = {}) {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error('请先在设置页面配置 AI API Key');
  }

  const endpoint = config.endpoint.replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---- AI 总结 / 多轮对话 ----

const CHAT_SYSTEM_PROMPT = '你是一个广告竞价策略分析专家。用户会给你一个竞价策略的流程图描述，你需要帮助用户理解和分析这个策略。回答要简洁、有条理、使用中文，适合非技术人员阅读。你可以：1）分析策略的核心决策逻辑 2）说明在什么情况下会加价、降价或保持 3）评估策略的优缺点 4）回答用户关于策略的任何问题 5）给出优化建议。';

/**
 * 构建 AI 策略对话的初始系统消息 + 策略描述
 */
export function buildChatInitMessages(nodes, edges) {
  const flowText = flowToText(nodes, edges);
  return [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: `以下是当前的竞价策略流程图，请先总结分析：\n\n${flowText}` },
  ];
}

/**
 * AI 多轮对话 — 流式输出
 * @param {Array<{role: string, content: string}>} messages 完整消息列表
 * @param {(chunk: string) => void} onChunk 每收到一段文本时的回调
 * @returns {Promise<string>} 完整回复内容
 */
export async function chatAboutStrategy(messages, onChunk) {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error('请先在设置页面配置 AI API Key');
  }

  const endpoint = config.endpoint.replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(full);
        }
      } catch {}
    }
  }

  return full;
}

// 兼容旧调用
export async function summarizeFlow(nodes, edges) {
  const msgs = buildChatInitMessages(nodes, edges);
  return callAi(msgs, { maxTokens: 1000 });
}

// ---- AI 生成/修改策略 ----

const GENERATE_SYSTEM_PROMPT = `你是一个广告竞价策略流程图生成专家。用户会描述期望的竞价策略效果，你需要生成一个合法的策略流程图 JSON。

## 输出格式

你必须且只能输出一个 JSON 代码块，格式如下：

\`\`\`json
{
  "nodes": [...],
  "edges": [...]
}
\`\`\`

## 节点类型

1. **start** - 开始节点（必须有且只有一个）
   \`{ "id": "start", "type": "start" }\`

2. **condition** - 条件判断节点
   \`{ "id": "唯一ID", "type": "condition", "expr": "表达式" }\`

3. **action** - 动作节点
   \`{ "id": "唯一ID", "type": "action", "action": "RAISE|LOWER|KEEP|SKIP", "targetExpr": "目标价表达式" }\`
   - RAISE（加价）和 LOWER（降价）必须有 targetExpr
   - KEEP（保持当前价格）和 SKIP（跳过）不需要 targetExpr

4. **setVar** - 设置变量节点
   \`{ "id": "唯一ID", "type": "setVar", "varName": "变量名", "expr": "计算表达式" }\`
   - 设置的变量在后续节点中用 vars.变量名 访问

## 边的格式

\`{ "from": "源节点ID", "to": "目标节点ID", "branch": "yes|no" }\`
- 从 condition 节点出发的边必须有 branch: "yes" 或 "no"
- 从其他节点出发的边不需要 branch

## 可用变量

- myAd.rank - 我的排名（数字，1是第一名）
- myAd.price - 我的当前价格
- above.price - 上方（排名更高）广告的价格
- above.rank - 上方广告的排名
- above - 上方广告对象（可能为 null）
- below.price - 下方（排名更低）广告的价格
- below.rank - 下方广告的排名
- below - 下方广告对象（可能为 null）
- budgetLimit - 预算上限
- gapThreshold - 价差阈值（配置的降价触发间距）
- rankLimit - 排名上限（目标最高排名）
- rankings.length - 排名总数

## 表达式语法

- 支持算术运算: +, -, *, /
- 支持比较: >, <, >=, <=, ==, !=
- 支持逻辑: &&, ||, !
- 支持 null 判断: above == null, below != null
- 自定义变量访问: vars.变量名

## 重要规则

1. 每个节点 id 必须唯一
2. 必须有且仅有一个 start 节点
3. 条件节点必须有 yes 和 no 两条出边
4. 所有叶子路径应终止于 action 节点
5. 边的 from 和 to 必须引用已存在的节点 id
6. 只输出 JSON 代码块，不要输出其他内容`;

/**
 * AI 生成或修改策略
 * @param {string} userRequest 用户的需求描述
 * @param {{ nodes: Array, edges: Array } | null} currentGraph 当前策略（引擎格式），null 表示全新生成
 * @returns {Promise<{ nodes: Array, edges: Array }>} 引擎格式的策略图
 */
export async function generateStrategy(userRequest, currentGraph) {
  let userContent;
  if (currentGraph && currentGraph.nodes?.length > 1) {
    const currentText = engineGraphToText(currentGraph);
    userContent = `当前策略流程图：\n${currentText}\n\n用户修改要求：${userRequest}`;
  } else {
    userContent = `请根据以下需求生成全新的竞价策略流程图：\n\n${userRequest}`;
  }

  const raw = await callAi([
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], { temperature: 0.2, maxTokens: 3000 });

  // 提取 JSON 代码块
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    throw new Error('AI 未返回有效的 JSON 代码块，请重试');
  }

  let graph;
  try {
    graph = JSON.parse(jsonMatch[1].trim());
  } catch (e) {
    throw new Error(`AI 返回的 JSON 解析失败: ${e.message}`);
  }

  return graph;
}

// ---- AI 评审策略是否达标 ----

const REVIEW_SYSTEM_PROMPT = `你是一个广告竞价策略评审专家。你需要评判一个 AI 生成的竞价策略流程图是否满足用户的需求。

## 你的任务

1. 仔细理解用户的原始需求
2. 分析生成的策略是否完整地满足了这些需求
3. 给出评审结论和策略总结

## 输出格式

你必须且只能输出一个 JSON 代码块：

\`\`\`json
{
  "pass": true/false,
  "summary": "策略的整体效果总结（2-4句话，面向非技术人员）",
  "issues": ["不达标原因1", "不达标原因2"],
  "suggestions": ["改进建议1"]
}
\`\`\`

- pass=true 表示策略基本满足用户需求（允许有小的可优化空间）
- pass=false 表示策略有明显遗漏或逻辑错误
- summary 始终填写，用简洁中文描述策略效果
- issues 仅在 pass=false 时填写
- suggestions 可选，给出优化建议`;

/**
 * AI 评审策略是否达标
 * @param {{ nodes: Array, edges: Array }} graph 生成的策略（引擎格式）
 * @param {string} userRequest 用户原始需求
 * @param {{ nodes: Array, edges: Array } | null} originalGraph 原策略（修改场景）
 * @returns {Promise<{ pass: boolean, summary: string, issues: string[], suggestions: string[] }>}
 */
export async function reviewStrategy(graph, userRequest, originalGraph) {
  const graphText = engineGraphToText(graph);
  let userContent = `## 用户需求\n${userRequest}\n\n## AI 生成的策略\n${graphText}`;

  if (originalGraph && originalGraph.nodes?.length > 1) {
    const originalText = engineGraphToText(originalGraph);
    userContent = `## 用户需求\n${userRequest}\n\n## 原策略（修改前）\n${originalText}\n\n## AI 生成的新策略\n${graphText}`;
  }

  const raw = await callAi([
    { role: 'system', content: REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], { temperature: 0.1, maxTokens: 1000 });

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    // 解析失败时默认通过，附带原始回复作为 summary
    return { pass: true, summary: raw.slice(0, 200), issues: [], suggestions: [] };
  }

  try {
    const result = JSON.parse(jsonMatch[1].trim());
    return {
      pass: !!result.pass,
      summary: result.summary || '',
      issues: result.issues || [],
      suggestions: result.suggestions || [],
    };
  } catch {
    return { pass: true, summary: raw.slice(0, 200), issues: [], suggestions: [] };
  }
}

/**
 * AI 根据评审反馈重新生成策略
 * @param {string} userRequest 用户原始需求
 * @param {{ nodes: Array, edges: Array } | null} originalGraph 原策略
 * @param {{ nodes: Array, edges: Array }} failedGraph 评审不达标的策略
 * @param {{ issues: string[], suggestions: string[] }} reviewFeedback 评审反馈
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function regenerateStrategy(userRequest, originalGraph, failedGraph, reviewFeedback) {
  const failedText = engineGraphToText(failedGraph);
  const issueList = reviewFeedback.issues.map((i) => `  - ${i}`).join('\n');
  const sugList = reviewFeedback.suggestions?.length > 0
    ? '\n改进建议：\n' + reviewFeedback.suggestions.map((s) => `  - ${s}`).join('\n')
    : '';

  let userContent = `## 用户需求\n${userRequest}\n\n`;

  if (originalGraph && originalGraph.nodes?.length > 1) {
    const originalText = engineGraphToText(originalGraph);
    userContent += `## 原策略（用户要求在此基础上修改）\n${originalText}\n\n`;
  }

  userContent += `## 上次生成的策略（评审不达标）\n${failedText}\n\n## 评审指出的问题\n${issueList}${sugList}\n\n请根据用户需求和评审反馈重新生成策略，确保解决所有指出的问题。`;

  const raw = await callAi([
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], { temperature: 0.2, maxTokens: 3000 });

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    throw new Error('AI 重新生成后未返回有效的 JSON 代码块');
  }

  let graph;
  try {
    graph = JSON.parse(jsonMatch[1].trim());
  } catch (e) {
    throw new Error(`AI 重新生成的 JSON 解析失败: ${e.message}`);
  }

  return graph;
}

/**
 * AI 修复校验失败的策略
 * @param {{ nodes: Array, edges: Array }} brokenGraph 校验失败的图
 * @param {string[]} errors 错误列表
 * @param {string[]} warnings 警告列表
 * @returns {Promise<{ nodes: Array, edges: Array }>}
 */
export async function fixStrategy(brokenGraph, errors, warnings) {
  const graphJson = JSON.stringify(brokenGraph, null, 2);
  const errorList = errors.map((e) => `  错误: ${e}`).join('\n');
  const warnList = warnings.length > 0
    ? '\n' + warnings.map((w) => `  警告: ${w}`).join('\n')
    : '';

  const userContent = `你上次生成的策略流程图未通过合法性校验，请修复以下问题并重新输出完整的 JSON。

上次生成的 JSON：
\`\`\`json
${graphJson}
\`\`\`

校验发现的问题：
${errorList}${warnList}

请仔细检查每个边的 from 和 to 是否都引用了 nodes 中存在的节点 id，修复所有问题后重新输出完整的 JSON。`;

  const raw = await callAi([
    { role: 'system', content: GENERATE_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], { temperature: 0.1, maxTokens: 3000 });

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    throw new Error('AI 修复后未返回有效的 JSON 代码块');
  }

  let graph;
  try {
    graph = JSON.parse(jsonMatch[1].trim());
  } catch (e) {
    throw new Error(`AI 修复返回的 JSON 解析失败: ${e.message}`);
  }

  return graph;
}
