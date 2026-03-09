// 变量名 → 中文显示
export const VAR_LABELS = {
  'myAd.rank': '我的排名',
  'myAd.price': '我的价格',
  'above.price': '上方价格',
  'above.rank': '上方排名',
  'below.price': '下方价格',
  'below.rank': '下方排名',
  'budgetLimit': '预算上限',
  'gapThreshold': '价差阈值',
  'rankLimit': '排名上限',
  'rankings.length': '排名总数',
};

// 动作类型 → 中文
export const ACTION_LABELS = {
  RAISE: '加价',
  LOWER: '降价',
  KEEP: '保持',
  SKIP: '跳过',
};

// 比较运算符 → 中文
export const OP_LABELS = {
  '>': '大于',
  '<': '小于',
  '>=': '大于等于',
  '<=': '小于等于',
  '==': '等于',
  '!=': '不等于',
};

// 将表达式中的英文变量名替换为中文显示
export function translateExpr(expr) {
  if (!expr) return '';
  let result = expr;
  // 先处理 vars.xxx → 「xxx」
  result = result.replace(/vars\.(\w+)/g, '「$1」');
  // 按长度降序排序，避免短的先匹配（如 above.price 先于 above）
  const sorted = Object.entries(VAR_LABELS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, label] of sorted) {
    result = result.replaceAll(key, label);
  }
  return result;
}

// 变量选项列表（用于下拉菜单）
export const VARIABLES = Object.entries(VAR_LABELS).map(([value, label]) => ({ value, label }));

// 价格相关变量（用于目标价基准选择）
export const PRICE_VARIABLES = VARIABLES.filter(
  (v) => v.value.includes('price') || v.value === 'budgetLimit'
);
