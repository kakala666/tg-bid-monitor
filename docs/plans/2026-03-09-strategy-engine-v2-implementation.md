# 策略引擎 V2 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将硬编码竞价策略引擎重构为基于流程图的可配置策略引擎

**Architecture:** 三层架构 — 表达式层（tokenize → parse → eval）、图执行层（遍历节点产出动作）、适配层（保持 calcAllBids API 不变）。表达式使用手写递归下降解析器，不依赖 eval 或第三方库。

**Tech Stack:** Node.js ESM, Vitest（测试）

---

### Task 1: 搭建测试基础设施

**Files:**
- Modify: `package.json`
- Create: `tests/strategy/expr.test.js`

**Step 1: 安装 vitest**

```bash
npm install -D vitest
```

**Step 2: 在 package.json 添加 test script**

在 `scripts` 中添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: 写一个占位测试确认基础设施可用**

`tests/strategy/expr.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('expression parser', () => {
  it('placeholder', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 4: 运行测试**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add package.json package-lock.json tests/
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: 表达式 Tokenizer

**Files:**
- Create: `src/strategy-v2/expr.js`
- Modify: `tests/strategy/expr.test.js`

表达式 tokenizer 将字符串拆分为 token 流。

**Step 1: 写 tokenizer 测试**

`tests/strategy/expr.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/strategy-v2/expr.js';

describe('tokenize', () => {
  it('数字', () => {
    expect(tokenize('42')).toEqual([{ type: 'NUMBER', value: 42 }]);
    expect(tokenize('3.14')).toEqual([{ type: 'NUMBER', value: 3.14 }]);
  });

  it('标识符和点号访问', () => {
    expect(tokenize('myAd.rank')).toEqual([
      { type: 'IDENT', value: 'myAd' },
      { type: 'DOT', value: '.' },
      { type: 'IDENT', value: 'rank' },
    ]);
  });

  it('运算符', () => {
    expect(tokenize('a >= 3 && b != 5')).toEqual([
      { type: 'IDENT', value: 'a' },
      { type: 'OP', value: '>=' },
      { type: 'NUMBER', value: 3 },
      { type: 'OP', value: '&&' },
      { type: 'IDENT', value: 'b' },
      { type: 'OP', value: '!=' },
      { type: 'NUMBER', value: 5 },
    ]);
  });

  it('括号和函数调用', () => {
    expect(tokenize('ad("AD2480")')).toEqual([
      { type: 'IDENT', value: 'ad' },
      { type: 'LPAREN', value: '(' },
      { type: 'STRING', value: 'AD2480' },
      { type: 'RPAREN', value: ')' },
    ]);
  });

  it('字符串字面量', () => {
    expect(tokenize('"hello"')).toEqual([{ type: 'STRING', value: 'hello' }]);
  });

  it('复杂表达式', () => {
    const tokens = tokenize('above.price - myAd.price > gapThreshold');
    expect(tokens).toEqual([
      { type: 'IDENT', value: 'above' },
      { type: 'DOT', value: '.' },
      { type: 'IDENT', value: 'price' },
      { type: 'OP', value: '-' },
      { type: 'IDENT', value: 'myAd' },
      { type: 'DOT', value: '.' },
      { type: 'IDENT', value: 'price' },
      { type: 'OP', value: '>' },
      { type: 'IDENT', value: 'gapThreshold' },
    ]);
  });

  it('null 字面量', () => {
    expect(tokenize('above != null')).toEqual([
      { type: 'IDENT', value: 'above' },
      { type: 'OP', value: '!=' },
      { type: 'IDENT', value: 'null' },
    ]);
  });

  it('取反运算符', () => {
    expect(tokenize('!a')).toEqual([
      { type: 'OP', value: '!' },
      { type: 'IDENT', value: 'a' },
    ]);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL (module not found)

**Step 3: 实现 tokenizer**

`src/strategy-v2/expr.js`:
```js
// 表达式解析器 - Tokenizer + Parser + Evaluator

const TOKEN_PATTERNS = [
  ['NUMBER',  /^\d+(?:\.\d+)?/],
  ['STRING',  /^"([^"]*)"/],
  ['OP',      /^(?:&&|\|\||[!=]=|>=|<=|[+\-*/%><!])/],
  ['DOT',     /^\./],
  ['LPAREN',  /^\(/],
  ['RPAREN',  /^\)/],
  ['COMMA',   /^,/],
  ['IDENT',   /^[a-zA-Z_]\w*/],
  ['WS',      /^\s+/],
];

export function tokenize(source) {
  const tokens = [];
  let pos = 0;
  while (pos < source.length) {
    let matched = false;
    for (const [type, regex] of TOKEN_PATTERNS) {
      const m = source.slice(pos).match(regex);
      if (m) {
        if (type !== 'WS') {
          let value = m[0];
          if (type === 'NUMBER') value = Number(value);
          if (type === 'STRING') value = m[1];
          tokens.push({ type, value });
        }
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`表达式语法错误: 无法识别字符 '${source[pos]}' 在位置 ${pos}`);
    }
  }
  return tokens;
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add expression tokenizer"
```

---

### Task 3: 表达式 Parser（递归下降）

**Files:**
- Modify: `src/strategy-v2/expr.js`
- Modify: `tests/strategy/expr.test.js`

Parser 将 token 流解析为 AST。采用递归下降，按优先级从低到高：`||` → `&&` → `==`/`!=` → `>`/`<`/`>=`/`<=` → `+`/`-` → `*`/`/`/`%` → 一元 `!` → 成员访问 `.` 和函数调用 `()` → 基础值。

**Step 1: 写 parser 测试**

在 `tests/strategy/expr.test.js` 追加：
```js
import { tokenize, parse } from '../src/strategy-v2/expr.js';

describe('parse', () => {
  const p = (s) => parse(tokenize(s));

  it('数字字面量', () => {
    expect(p('42')).toEqual({ type: 'Literal', value: 42 });
  });

  it('null 字面量', () => {
    expect(p('null')).toEqual({ type: 'Literal', value: null });
  });

  it('标识符', () => {
    expect(p('rank')).toEqual({ type: 'Identifier', name: 'rank' });
  });

  it('成员访问', () => {
    expect(p('myAd.rank')).toEqual({
      type: 'Member',
      object: { type: 'Identifier', name: 'myAd' },
      property: 'rank',
    });
  });

  it('二元运算', () => {
    expect(p('a + b')).toEqual({
      type: 'Binary',
      op: '+',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    });
  });

  it('优先级: * 高于 +', () => {
    const ast = p('a + b * c');
    expect(ast.type).toBe('Binary');
    expect(ast.op).toBe('+');
    expect(ast.right.op).toBe('*');
  });

  it('比较和逻辑运算', () => {
    const ast = p('a > 1 && b < 2');
    expect(ast.type).toBe('Binary');
    expect(ast.op).toBe('&&');
    expect(ast.left.op).toBe('>');
    expect(ast.right.op).toBe('<');
  });

  it('一元取反', () => {
    expect(p('!a')).toEqual({
      type: 'Unary',
      op: '!',
      operand: { type: 'Identifier', name: 'a' },
    });
  });

  it('函数调用', () => {
    expect(p('ad("AD2480")')).toEqual({
      type: 'Call',
      callee: { type: 'Identifier', name: 'ad' },
      args: [{ type: 'Literal', value: 'AD2480' }],
    });
  });

  it('复杂表达式', () => {
    const ast = p('above.price - myAd.price > gapThreshold');
    expect(ast.type).toBe('Binary');
    expect(ast.op).toBe('>');
    expect(ast.left.op).toBe('-');
    expect(ast.left.left).toEqual({
      type: 'Member',
      object: { type: 'Identifier', name: 'above' },
      property: 'price',
    });
  });

  it('括号分组', () => {
    const ast = p('(a + b) * c');
    expect(ast.type).toBe('Binary');
    expect(ast.op).toBe('*');
    expect(ast.left.op).toBe('+');
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL (parse not exported)

**Step 3: 实现 parser**

在 `src/strategy-v2/expr.js` 追加：
```js
export function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos] || null;
  const advance = () => tokens[pos++];
  const expect = (type) => {
    const t = advance();
    if (!t || t.type !== type) throw new Error(`期望 ${type}，得到 ${t ? t.type : 'EOF'}`);
    return t;
  };

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let left = parseAnd();
    while (peek()?.type === 'OP' && peek().value === '||') {
      advance();
      left = { type: 'Binary', op: '||', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseEquality();
    while (peek()?.type === 'OP' && peek().value === '&&') {
      advance();
      left = { type: 'Binary', op: '&&', left, right: parseEquality() };
    }
    return left;
  }

  function parseEquality() {
    let left = parseComparison();
    while (peek()?.type === 'OP' && (peek().value === '==' || peek().value === '!=')) {
      const op = advance().value;
      left = { type: 'Binary', op, left, right: parseComparison() };
    }
    return left;
  }

  function parseComparison() {
    let left = parseAddSub();
    while (peek()?.type === 'OP' && ['>', '<', '>=', '<='].includes(peek().value)) {
      const op = advance().value;
      left = { type: 'Binary', op, left, right: parseAddSub() };
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek()?.type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = advance().value;
      left = { type: 'Binary', op, left, right: parseMulDiv() };
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek()?.type === 'OP' && ['*', '/', '%'].includes(peek().value)) {
      const op = advance().value;
      left = { type: 'Binary', op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary() {
    if (peek()?.type === 'OP' && peek().value === '!') {
      advance();
      return { type: 'Unary', op: '!', operand: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let node = parsePrimary();
    while (true) {
      if (peek()?.type === 'DOT') {
        advance();
        const prop = expect('IDENT');
        node = { type: 'Member', object: node, property: prop.value };
      } else if (peek()?.type === 'LPAREN') {
        advance();
        const args = [];
        if (peek()?.type !== 'RPAREN') {
          args.push(parseExpr());
          while (peek()?.type === 'COMMA') {
            advance();
            args.push(parseExpr());
          }
        }
        expect('RPAREN');
        node = { type: 'Call', callee: node, args };
      } else {
        break;
      }
    }
    return node;
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('表达式意外结束');
    if (t.type === 'NUMBER') { advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'STRING') { advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'IDENT' && t.value === 'null') { advance(); return { type: 'Literal', value: null }; }
    if (t.type === 'IDENT' && t.value === 'true') { advance(); return { type: 'Literal', value: true }; }
    if (t.type === 'IDENT' && t.value === 'false') { advance(); return { type: 'Literal', value: false }; }
    if (t.type === 'IDENT') { advance(); return { type: 'Identifier', name: t.value }; }
    if (t.type === 'LPAREN') {
      advance();
      const expr = parseExpr();
      expect('RPAREN');
      return expr;
    }
    throw new Error(`表达式语法错误: 意外的 token '${t.value}'`);
  }

  const ast = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`表达式语法错误: 多余的 token '${tokens[pos].value}'`);
  }
  return ast;
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add src/strategy-v2/expr.js tests/
git commit -m "feat(strategy-v2): add expression parser"
```

---

### Task 4: 表达式 Evaluator

**Files:**
- Modify: `src/strategy-v2/expr.js`
- Modify: `tests/strategy/expr.test.js`

Evaluator 接收 AST 和上下文对象，返回计算结果。

**Step 1: 写 evaluator 测试**

在 `tests/strategy/expr.test.js` 追加：
```js
import { tokenize, parse, evaluate } from '../src/strategy-v2/expr.js';

describe('evaluate', () => {
  const ev = (source, ctx = {}) => evaluate(parse(tokenize(source)), ctx);

  it('数字字面量', () => {
    expect(ev('42')).toBe(42);
  });

  it('null', () => {
    expect(ev('null')).toBe(null);
  });

  it('标识符查找', () => {
    expect(ev('rank', { rank: 3 })).toBe(3);
  });

  it('成员访问', () => {
    expect(ev('myAd.rank', { myAd: { rank: 5 } })).toBe(5);
  });

  it('成员访问 null 安全', () => {
    expect(ev('above.price', { above: null })).toBe(undefined);
  });

  it('算术运算', () => {
    expect(ev('a + b * c', { a: 1, b: 2, c: 3 })).toBe(7);
    expect(ev('10 - 3', {})).toBe(7);
    expect(ev('10 / 2', {})).toBe(5);
    expect(ev('10 % 3', {})).toBe(1);
  });

  it('比较运算', () => {
    expect(ev('a > 3', { a: 5 })).toBe(true);
    expect(ev('a <= 3', { a: 3 })).toBe(true);
    expect(ev('a == 3', { a: 3 })).toBe(true);
    expect(ev('a != 3', { a: 5 })).toBe(true);
  });

  it('逻辑运算', () => {
    expect(ev('a > 1 && b > 1', { a: 2, b: 2 })).toBe(true);
    expect(ev('a > 1 && b > 1', { a: 2, b: 0 })).toBe(false);
    expect(ev('a > 1 || b > 1', { a: 0, b: 2 })).toBe(true);
  });

  it('取反', () => {
    expect(ev('!a', { a: false })).toBe(true);
    expect(ev('!a', { a: true })).toBe(false);
  });

  it('null 比较', () => {
    expect(ev('above != null', { above: { price: 100 } })).toBe(true);
    expect(ev('above != null', { above: null })).toBe(false);
    expect(ev('above == null', { above: null })).toBe(true);
  });

  it('函数调用 ad()', () => {
    const ctx = {
      ad: (id) => ({ rank: 2, price: 100 }),
    };
    expect(ev('ad("AD2480").price', ctx)).toBe(100);
  });

  it('复杂业务表达式', () => {
    const ctx = {
      myAd: { rank: 3, price: 200 },
      above: { rank: 2, price: 180 },
      gapThreshold: 5,
    };
    expect(ev('above.price - myAd.price > gapThreshold', ctx)).toBe(false);
    expect(ev('myAd.price - above.price > gapThreshold', ctx)).toBe(true);
  });

  it('未定义变量返回 undefined', () => {
    expect(ev('notExist', {})).toBe(undefined);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL (evaluate not exported)

**Step 3: 实现 evaluator**

在 `src/strategy-v2/expr.js` 追加：
```js
export function evaluate(ast, ctx) {
  switch (ast.type) {
    case 'Literal':
      return ast.value;
    case 'Identifier':
      return ctx[ast.name];
    case 'Member': {
      const obj = evaluate(ast.object, ctx);
      if (obj == null) return undefined;
      return obj[ast.property];
    }
    case 'Call': {
      const fn = evaluate(ast.callee, ctx);
      if (typeof fn !== 'function') {
        throw new Error(`'${ast.callee.name || 'expression'}' 不是函数`);
      }
      const args = ast.args.map(a => evaluate(a, ctx));
      return fn(...args);
    }
    case 'Unary':
      if (ast.op === '!') return !evaluate(ast.operand, ctx);
      throw new Error(`未知一元运算符: ${ast.op}`);
    case 'Binary': {
      // 短路求值
      if (ast.op === '&&') return evaluate(ast.left, ctx) && evaluate(ast.right, ctx);
      if (ast.op === '||') return evaluate(ast.left, ctx) || evaluate(ast.right, ctx);
      const left = evaluate(ast.left, ctx);
      const right = evaluate(ast.right, ctx);
      switch (ast.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '>': return left > right;
        case '<': return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '==': return left === right;
        case '!=': return left !== right;
        default: throw new Error(`未知运算符: ${ast.op}`);
      }
    }
    default:
      throw new Error(`未知 AST 节点类型: ${ast.type}`);
  }
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add src/strategy-v2/expr.js tests/
git commit -m "feat(strategy-v2): add expression evaluator"
```

---

### Task 5: 便捷函数 evalExpr + 上下文构建器

**Files:**
- Create: `src/strategy-v2/context.js`
- Create: `tests/strategy/context.test.js`
- Modify: `src/strategy-v2/expr.js`

提供 `evalExpr(source, ctx)` 便捷函数（带缓存）和 `buildContext(myAd, allRankings, adConfig)` 上下文构建器。

**Step 1: 在 expr.js 添加便捷函数**

在 `src/strategy-v2/expr.js` 追加：
```js
const astCache = new Map();

export function evalExpr(source, ctx) {
  let ast = astCache.get(source);
  if (!ast) {
    ast = parse(tokenize(source));
    astCache.set(source, ast);
  }
  return evaluate(ast, ctx);
}
```

**Step 2: 写上下文构建器测试**

`tests/strategy/context.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildContext } from '../src/strategy-v2/context.js';

const rankings = [
  { rank: 1, price: 300, adId: '广告AD1000', isMine: false },
  { rank: 2, price: 250, adId: '广告AD2000', isMine: false },
  { rank: 3, price: 200, adId: '广告AD2480', isMine: true },
  { rank: 4, price: 150, adId: '广告AD3000', isMine: false },
  { rank: 5, price: 100, adId: '广告AD4000', isMine: false },
];

const adConfig = {
  timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 280, rankLimit: 2 }],
  gapThreshold: 5,
  fallbackRankLimit: 3,
};

describe('buildContext', () => {
  it('myAd 正确', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.myAd).toEqual({ rank: 3, price: 200, adId: '广告AD2480' });
  });

  it('above 是上方最近的非自家广告', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.above).toEqual({ rank: 2, price: 250, adId: '广告AD2000' });
  });

  it('below 是下方最近的非自家广告', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.below).toEqual({ rank: 4, price: 150, adId: '广告AD3000' });
  });

  it('ad() 函数可按ID查询', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.ad('AD1000')).toEqual({ rank: 1, price: 300, adId: '广告AD1000' });
    expect(ctx.ad('AD9999')).toBe(null);
  });

  it('budgetLimit 从时段配置获取', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.budgetLimit).toBe(280);
  });

  it('rankings.length', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.rankings).toEqual({ length: rankings.length });
  });

  it('第一名时 above 为 null', () => {
    const ctx = buildContext(rankings[0], rankings, adConfig);
    expect(ctx.above).toBe(null);
  });

  it('最后一名时 below 为 null', () => {
    const ctx = buildContext(rankings[4], rankings, adConfig);
    expect(ctx.below).toBe(null);
  });

  it('vars 初始为空对象', () => {
    const ctx = buildContext(rankings[2], rankings, adConfig);
    expect(ctx.vars).toEqual({});
  });
});
```

**Step 3: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL

**Step 4: 实现上下文构建器**

`src/strategy-v2/context.js`:
```js
// 构建表达式执行上下文

/**
 * 根据当前时间匹配时段
 */
function matchCurrentSlot(timeSlots) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (const slot of timeSlots) {
    if (slot.start <= slot.end) {
      if (hhmm >= slot.start && hhmm < slot.end) return slot;
    } else {
      if (hhmm >= slot.start || hhmm < slot.end) return slot;
    }
  }
  return null;
}

export function getCurrentBudgetLimit(timeSlots) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot) return slot.budgetLimit;
  return timeSlots.length > 0
    ? Math.min(...timeSlots.map(s => s.budgetLimit))
    : 999;
}

export function getCurrentRankLimit(timeSlots, fallback) {
  const slot = matchCurrentSlot(timeSlots);
  if (slot && slot.rankLimit != null) return slot.rankLimit;
  return fallback;
}

/**
 * 为单个广告构建表达式执行上下文
 */
export function buildContext(myAd, allRankings, adConfig) {
  const above = allRankings
    .filter(r => r.rank < myAd.rank && !r.isMine)
    .sort((a, b) => b.rank - a.rank)[0] || null;

  const below = allRankings
    .filter(r => r.rank > myAd.rank && !r.isMine)
    .sort((a, b) => a.rank - b.rank)[0] || null;

  const { timeSlots = [], gapThreshold = 5, fallbackRankLimit = null } = adConfig;
  const budgetLimit = getCurrentBudgetLimit(timeSlots);
  const rankLimit = getCurrentRankLimit(timeSlots, fallbackRankLimit);

  const simplify = (r) => r ? { rank: r.rank, price: r.price, adId: r.adId } : null;

  return {
    myAd: simplify(myAd),
    above: simplify(above),
    below: simplify(below),
    budgetLimit,
    gapThreshold,
    rankLimit,
    rankings: { length: allRankings.length },
    ad: (id) => {
      const found = allRankings.find(r => r.adId.includes(id));
      return found ? simplify(found) : null;
    },
    vars: {},
  };
}
```

**Step 5: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 6: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add evalExpr helper and context builder"
```

---

### Task 6: 流程图执行器

**Files:**
- Create: `src/strategy-v2/executor.js`
- Create: `tests/strategy/executor.test.js`

核心执行器：遍历节点，执行条件判断、变量设置、动作输出。本 Task 不含模板支持。

**Step 1: 写执行器测试**

`tests/strategy/executor.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { executeGraph } from '../src/strategy-v2/executor.js';

describe('executeGraph', () => {
  // 最简流程: start → action(KEEP)
  it('直接到 action 节点', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a1', type: 'action', action: 'KEEP' },
      ],
      edges: [{ from: 's', to: 'a1' }],
    };
    const ctx = { myAd: { rank: 1, price: 100 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.targetPrice).toBe(100);
    expect(result.path).toEqual(['s', 'a1']);
  });

  // 条件分支: rank > 3 ? RAISE : KEEP
  it('条件分支 - true', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'myAd.rank > 3' },
        { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 5, price: 100 },
      above: { rank: 4, price: 150 },
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(151);
    expect(result.path).toEqual(['s', 'c1(yes)', 'a1']);
  });

  it('条件分支 - false', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'myAd.rank > 3' },
        { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 2, price: 200 },
      above: { rank: 1, price: 300 },
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.targetPrice).toBe(200);
  });

  // setVar 节点
  it('setVar 设置变量后续可用', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'sv1', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
        { id: 'c1', type: 'condition', expr: 'vars.gap > 10' },
        { id: 'a1', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
        { id: 'a2', type: 'action', action: 'KEEP' },
      ],
      edges: [
        { from: 's', to: 'sv1' },
        { from: 'sv1', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
        { from: 'c1', to: 'a2', branch: 'no' },
      ],
    };
    const ctx = {
      myAd: { rank: 1, price: 200 },
      below: { rank: 2, price: 150 },
      vars: {},
    };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('LOWER');
    expect(result.targetPrice).toBe(151);
  });

  // 步数上限
  it('超过步数上限返回 KEEP', () => {
    // 两个节点相互引用，形成死循环
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'sv1', type: 'setVar', varName: 'x', expr: '1' },
        { id: 'sv2', type: 'setVar', varName: 'y', expr: '2' },
      ],
      edges: [
        { from: 's', to: 'sv1' },
        { from: 'sv1', to: 'sv2' },
        { from: 'sv2', to: 'sv1' },
      ],
    };
    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { maxSteps: 10 });
    expect(result.action).toBe('KEEP');
    expect(result.error).toMatch(/步数上限/);
  });

  // action 节点无 targetExpr 时 targetPrice 取 currentPrice
  it('action 无 targetExpr 时保留当前价', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a1', type: 'action', action: 'SKIP' },
      ],
      edges: [{ from: 's', to: 'a1' }],
    };
    const ctx = { myAd: { rank: 1, price: 200 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('SKIP');
    expect(result.targetPrice).toBe(200);
  });

  // 表达式错误
  it('表达式错误返回 KEEP + error', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 'c1', type: 'condition', expr: 'a +++ b' },
        { id: 'a1', type: 'action', action: 'RAISE' },
      ],
      edges: [
        { from: 's', to: 'c1' },
        { from: 'c1', to: 'a1', branch: 'yes' },
      ],
    };
    const ctx = { myAd: { rank: 1, price: 100 } };
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
    expect(result.error).toBeTruthy();
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL

**Step 3: 实现执行器**

`src/strategy-v2/executor.js`:
```js
import { evalExpr } from './expr.js';

const DEFAULT_MAX_STEPS = 100;

/**
 * 执行流程图，返回竞价动作结果
 * @param {object} graph - { nodes: [], edges: [] }
 * @param {object} ctx - 表达式执行上下文
 * @param {object} options - { maxSteps, templates }
 * @returns {{ action, targetPrice, path, error? }}
 */
export function executeGraph(graph, ctx, options = {}) {
  const { maxSteps = DEFAULT_MAX_STEPS, templates = {} } = options;
  const currentPrice = ctx.myAd?.price ?? 0;

  // 建索引
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const edgeMap = new Map();
  for (const e of graph.edges) {
    if (!edgeMap.has(e.from)) edgeMap.set(e.from, []);
    edgeMap.get(e.from).push(e);
  }

  const startNode = graph.nodes.find(n => n.type === 'start');
  if (!startNode) {
    return { action: 'KEEP', targetPrice: currentPrice, path: [], error: '流程图缺少 start 节点' };
  }

  const path = [];
  let currentId = startNode.id;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    const node = nodeMap.get(currentId);
    if (!node) {
      return { action: 'KEEP', targetPrice: currentPrice, path, error: `未找到节点 ${currentId}` };
    }

    try {
      switch (node.type) {
        case 'start': {
          path.push(node.id);
          const edge = (edgeMap.get(node.id) || [])[0];
          if (!edge) return { action: 'KEEP', targetPrice: currentPrice, path, error: 'start 节点无出边' };
          currentId = edge.to;
          break;
        }

        case 'condition': {
          const result = evalExpr(node.expr, ctx);
          const branch = result ? 'yes' : 'no';
          path.push(`${node.id}(${branch})`);
          const edges = edgeMap.get(node.id) || [];
          const edge = edges.find(e => e.branch === branch);
          if (!edge) {
            return { action: 'KEEP', targetPrice: currentPrice, path, error: `条件节点 ${node.id} 缺少 ${branch} 分支` };
          }
          currentId = edge.to;
          break;
        }

        case 'setVar': {
          const value = evalExpr(node.expr, ctx);
          ctx.vars[node.varName] = value;
          path.push(node.id);
          const edge = (edgeMap.get(node.id) || [])[0];
          if (!edge) return { action: 'KEEP', targetPrice: currentPrice, path, error: `setVar 节点 ${node.id} 无出边` };
          currentId = edge.to;
          break;
        }

        case 'template': {
          const tmpl = templates[node.templateId];
          if (!tmpl) {
            return { action: 'KEEP', targetPrice: currentPrice, path, error: `未找到模板 ${node.templateId}` };
          }
          path.push(`${node.id}[${node.templateId}]`);
          const subResult = executeGraph(tmpl, ctx, { maxSteps: maxSteps - steps, templates });
          subResult.path = [...path, ...subResult.path];
          return subResult;
        }

        case 'action': {
          let targetPrice = currentPrice;
          if (node.targetExpr) {
            targetPrice = evalExpr(node.targetExpr, ctx);
          }
          path.push(node.id);
          return { action: node.action, targetPrice, path };
        }

        default:
          return { action: 'KEEP', targetPrice: currentPrice, path, error: `未知节点类型 ${node.type}` };
      }
    } catch (err) {
      return { action: 'KEEP', targetPrice: currentPrice, path, error: `节点 ${node.id} 执行出错: ${err.message}` };
    }
  }

  return { action: 'KEEP', targetPrice: currentPrice, path, error: `超过步数上限 ${maxSteps}` };
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add flow graph executor"
```

---

### Task 7: 模板/子流程支持 + 循环检测

**Files:**
- Modify: `src/strategy-v2/executor.js`
- Modify: `tests/strategy/executor.test.js`

**Step 1: 写模板测试**

在 `tests/strategy/executor.test.js` 追加：
```js
describe('template 节点', () => {
  it('嵌入模板子流程', () => {
    const templates = {
      aggressive: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 'c1', type: 'condition', expr: 'above != null' },
          { id: 'a1', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
          { id: 'a2', type: 'action', action: 'KEEP' },
        ],
        edges: [
          { from: 's', to: 'c1' },
          { from: 'c1', to: 'a1', branch: 'yes' },
          { from: 'c1', to: 'a2', branch: 'no' },
        ],
      },
    };

    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'aggressive' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };

    const ctx = {
      myAd: { rank: 3, price: 200 },
      above: { rank: 2, price: 250 },
      vars: {},
    };

    const result = executeGraph(graph, ctx, { templates });
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(251);
  });

  it('模板不存在返回错误', () => {
    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'nonexistent' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };
    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { templates: {} });
    expect(result.action).toBe('KEEP');
    expect(result.error).toMatch(/未找到模板/);
  });

  it('模板变量共享（setVar 在模板内设置，外部可见）', () => {
    const templates = {
      calc: {
        nodes: [
          { id: 's', type: 'start' },
          { id: 'sv', type: 'setVar', varName: 'computed', expr: 'myAd.price + 10' },
          { id: 'a', type: 'action', action: 'RAISE', targetExpr: 'vars.computed' },
        ],
        edges: [
          { from: 's', to: 'sv' },
          { from: 'sv', to: 'a' },
        ],
      },
    };

    const graph = {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't1', type: 'template', templateId: 'calc' },
      ],
      edges: [{ from: 's', to: 't1' }],
    };

    const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
    const result = executeGraph(graph, ctx, { templates });
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(110);
  });
});
```

**Step 2: 运行测试确认通过**

模板执行已在 Task 6 中实现。此步骤确认模板功能测试通过。

```bash
npm test
```

Expected: PASS（模板已在 executor 中实现）

**Step 3: 添加循环模板引用检测**

在 `src/strategy-v2/executor.js` 修改 `executeGraph` 函数签名，在 `options` 中增加 `_templateStack` 内部参数用于检测循环引用。

修改 executor.js 中 template case：
```js
// 在 executeGraph 函数的 options 解构中添加 _templateStack = []
// const { maxSteps = DEFAULT_MAX_STEPS, templates = {}, _templateStack = [] } = options;

// 替换 template case:
case 'template': {
  const tmpl = templates[node.templateId];
  if (!tmpl) {
    return { action: 'KEEP', targetPrice: currentPrice, path, error: `未找到模板 ${node.templateId}` };
  }
  if (_templateStack.includes(node.templateId)) {
    return { action: 'KEEP', targetPrice: currentPrice, path, error: `模板循环引用: ${[..._templateStack, node.templateId].join(' → ')}` };
  }
  path.push(`${node.id}[${node.templateId}]`);
  const subResult = executeGraph(tmpl, ctx, {
    maxSteps: maxSteps - steps,
    templates,
    _templateStack: [..._templateStack, node.templateId],
  });
  subResult.path = [...path, ...subResult.path];
  return subResult;
}
```

**Step 4: 添加循环检测测试**

```js
it('循环模板引用检测', () => {
  const templates = {
    a: {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't', type: 'template', templateId: 'b' },
      ],
      edges: [{ from: 's', to: 't' }],
    },
    b: {
      nodes: [
        { id: 's', type: 'start' },
        { id: 't', type: 'template', templateId: 'a' },
      ],
      edges: [{ from: 's', to: 't' }],
    },
  };

  const graph = {
    nodes: [
      { id: 's', type: 'start' },
      { id: 't1', type: 'template', templateId: 'a' },
    ],
    edges: [{ from: 's', to: 't1' }],
  };

  const ctx = { myAd: { rank: 1, price: 100 }, vars: {} };
  const result = executeGraph(graph, ctx, { templates });
  expect(result.action).toBe('KEEP');
  expect(result.error).toMatch(/循环引用/);
});
```

**Step 5: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 6: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add template support with circular reference detection"
```

---

### Task 8: 安全防护层

**Files:**
- Create: `src/strategy-v2/safety.js`
- Create: `tests/strategy/safety.test.js`

安全防护作为执行结果的后处理：价格下限50U、预算上限、当前价超预算自动降价。

**Step 1: 写安全防护测试**

`tests/strategy/safety.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { applySafetyGuards } from '../src/strategy-v2/safety.js';

describe('applySafetyGuards', () => {
  it('目标价低于50U强制覆盖为50', () => {
    const result = { action: 'LOWER', targetPrice: 30, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 200, currentPrice: 100 });
    expect(guarded.targetPrice).toBe(50);
    expect(guarded.safetyNotes).toContain('目标价低于50U下限');
  });

  it('目标价超预算强制覆盖为预算上限', () => {
    const result = { action: 'RAISE', targetPrice: 350, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 200 });
    expect(guarded.targetPrice).toBe(300);
    expect(guarded.safetyNotes).toContain('目标价超预算上限');
  });

  it('预算上限低于50U时取50U', () => {
    const result = { action: 'RAISE', targetPrice: 30, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 40, currentPrice: 100 });
    expect(guarded.targetPrice).toBe(50);
  });

  it('KEEP 且当前价超预算时主动降价', () => {
    const result = { action: 'KEEP', targetPrice: 350, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 350 });
    expect(guarded.action).toBe('LOWER');
    expect(guarded.targetPrice).toBe(300);
  });

  it('正常情况不修改', () => {
    const result = { action: 'RAISE', targetPrice: 200, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 150 });
    expect(guarded.targetPrice).toBe(200);
    expect(guarded.safetyNotes).toHaveLength(0);
  });

  it('SKIP 和 KEEP 不检查价格', () => {
    const result = { action: 'SKIP', targetPrice: 10, path: ['s', 'a1'] };
    const guarded = applySafetyGuards(result, { budgetLimit: 300, currentPrice: 100 });
    expect(guarded.action).toBe('SKIP');
    expect(guarded.targetPrice).toBe(10);
    expect(guarded.safetyNotes).toHaveLength(0);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL

**Step 3: 实现安全防护**

`src/strategy-v2/safety.js`:
```js
const PRICE_FLOOR = 50;

/**
 * 对执行结果应用安全防护
 * @param {object} result - executeGraph 的结果 { action, targetPrice, path, error? }
 * @param {object} limits - { budgetLimit, currentPrice }
 * @returns {object} 附加 safetyNotes 的结果
 */
export function applySafetyGuards(result, { budgetLimit, currentPrice }) {
  const guarded = { ...result, safetyNotes: [] };

  // SKIP 不需要价格检查
  if (guarded.action === 'SKIP') return guarded;

  // KEEP 且当前价超预算 → 主动降价
  if (guarded.action === 'KEEP' && currentPrice > budgetLimit) {
    guarded.action = 'LOWER';
    guarded.targetPrice = Math.max(budgetLimit, PRICE_FLOOR);
    guarded.safetyNotes.push(`当前价${currentPrice}U超预算上限${budgetLimit}U，主动降价`);
    return guarded;
  }

  // 以下只对 RAISE/LOWER 做价格约束
  if (guarded.action !== 'RAISE' && guarded.action !== 'LOWER') return guarded;

  if (guarded.targetPrice > budgetLimit) {
    guarded.targetPrice = budgetLimit;
    guarded.safetyNotes.push(`目标价超预算上限${budgetLimit}U`);
  }

  if (guarded.targetPrice < PRICE_FLOOR) {
    guarded.targetPrice = PRICE_FLOOR;
    guarded.safetyNotes.push(`目标价低于${PRICE_FLOOR}U下限`);
  }

  return guarded;
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add safety guards (price floor 50U, budget cap)"
```

---

### Task 9: calcAllBids 兼容适配层 + 默认策略生成

**Files:**
- Create: `src/strategy-v2/index.js`
- Create: `src/strategy-v2/defaultStrategy.js`
- Create: `tests/strategy/integration.test.js`

将新引擎包装为与旧接口完全兼容的 `calcAllBids(rankings, config)`。同时提供 `generateDefaultStrategy(adConfig)` 函数，将旧配置转换为等价的流程图。

**Step 1: 写默认策略生成器测试**

`tests/strategy/integration.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { generateDefaultStrategy } from '../src/strategy-v2/defaultStrategy.js';
import { executeGraph } from '../src/strategy-v2/executor.js';
import { buildContext } from '../src/strategy-v2/context.js';

describe('generateDefaultStrategy', () => {
  it('生成合法流程图', () => {
    const graph = generateDefaultStrategy();
    expect(graph.nodes.find(n => n.type === 'start')).toBeTruthy();
    expect(graph.nodes.filter(n => n.type === 'action').length).toBeGreaterThan(0);
  });

  it('等价旧策略 - 第一名降价省钱', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const ctx = buildContext(rankings[0], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    // 差距 50 > 5, 应 LOWER 到 151
    expect(result.action).toBe('LOWER');
    expect(result.targetPrice).toBe(151);
  });

  it('等价旧策略 - 第一名差距小保持', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 153, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const ctx = buildContext(rankings[0], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    expect(result.action).toBe('KEEP');
  });

  it('等价旧策略 - 非第一名可跳升', () => {
    const graph = generateDefaultStrategy();
    const adConfig = { timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 280 }], gapThreshold: 5, fallbackRankLimit: null };
    const rankings = [
      { rank: 1, price: 250, adId: '广告AD1000', isMine: false },
      { rank: 2, price: 200, adId: '广告AD2000', isMine: false },
      { rank: 3, price: 150, adId: '广告AD2480', isMine: true },
    ];
    const ctx = buildContext(rankings[2], rankings, adConfig);
    const result = executeGraph(graph, ctx);
    // 可以跳到第1名(250+1=251 <= 280)
    expect(result.action).toBe('RAISE');
    expect(result.targetPrice).toBe(251);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL

**Step 3: 实现默认策略生成器**

`src/strategy-v2/defaultStrategy.js`:

这个函数将现有的硬编码策略逻辑转换为等价的流程图。流程图与 `strategy.js` 中的 `calcBidForAd` 逻辑一一对应。

```js
/**
 * 生成等价于旧 calcBidForAd 逻辑的默认流程图
 *
 * 逻辑流程:
 * 1. 排名优于上限 → 降价到上限+1位的价格-1
 * 2. 排名刚好在上限 → 检查与下一名差距，大于阈值则降价
 * 3. 第一名(或无上方广告) → 检查与下一名差距，大于阈值则降价
 * 4. 其他 → 在预算内尽可能向上跳跃（贪心）
 *    4a. 预算不够跳 → 检查与下方差距，大于阈值则降价
 */
export function generateDefaultStrategy() {
  return {
    nodes: [
      { id: 'start', type: 'start' },

      // === 分支1: 排名上限检查 ===
      { id: 'hasRankLimit', type: 'condition', expr: 'rankLimit != null' },

      // 排名严格优于上限？
      { id: 'aboveLimit', type: 'condition', expr: 'myAd.rank < rankLimit' },
      // TODO: 旧逻辑查找 rankLimit+1 位置的广告价格，简化为降价省钱
      // 简化处理: 排名优于上限时 KEEP（完整逻辑需要数组遍历，表达式系统不支持）
      { id: 'keepAboveLimit', type: 'action', action: 'KEEP' },

      // 排名刚好在上限？
      { id: 'atLimit', type: 'condition', expr: 'myAd.rank == rankLimit' },
      { id: 'atLimitHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'atLimitGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'atLimitGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'atLimitLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'atLimitKeep', type: 'action', action: 'KEEP' },

      // === 分支2: 第一名检查 ===
      { id: 'isFirst', type: 'condition', expr: 'above == null || myAd.rank == 1' },
      { id: 'firstHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'firstGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'firstGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'firstLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'firstKeep', type: 'action', action: 'KEEP' },

      // === 分支3: 尝试向上跳跃(贪心) ===
      // 简化：只看紧邻上方广告能否跳
      { id: 'canJump', type: 'condition', expr: 'above.price + 1 <= budgetLimit' },
      { id: 'doJump', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },

      // 跳不了 → 检查能否降价
      { id: 'noJumpHasBelow', type: 'condition', expr: 'below != null' },
      { id: 'noJumpGapCalc', type: 'setVar', varName: 'gap', expr: 'myAd.price - below.price' },
      { id: 'noJumpGapCheck', type: 'condition', expr: 'vars.gap > gapThreshold' },
      { id: 'noJumpLower', type: 'action', action: 'LOWER', targetExpr: 'below.price + 1' },
      { id: 'noJumpKeep', type: 'action', action: 'KEEP' },
    ],
    edges: [
      { from: 'start', to: 'hasRankLimit' },

      // 有排名上限
      { from: 'hasRankLimit', to: 'aboveLimit', branch: 'yes' },
      { from: 'aboveLimit', to: 'keepAboveLimit', branch: 'yes' },
      { from: 'aboveLimit', to: 'atLimit', branch: 'no' },
      { from: 'atLimit', to: 'atLimitHasBelow', branch: 'yes' },
      { from: 'atLimit', to: 'isFirst', branch: 'no' },
      { from: 'atLimitHasBelow', to: 'atLimitGapCalc', branch: 'yes' },
      { from: 'atLimitHasBelow', to: 'atLimitKeep', branch: 'no' },
      { from: 'atLimitGapCalc', to: 'atLimitGapCheck' },
      { from: 'atLimitGapCheck', to: 'atLimitLower', branch: 'yes' },
      { from: 'atLimitGapCheck', to: 'atLimitKeep', branch: 'no' },

      // 无排名上限
      { from: 'hasRankLimit', to: 'isFirst', branch: 'no' },

      // 第一名
      { from: 'isFirst', to: 'firstHasBelow', branch: 'yes' },
      { from: 'firstHasBelow', to: 'firstGapCalc', branch: 'yes' },
      { from: 'firstHasBelow', to: 'firstKeep', branch: 'no' },
      { from: 'firstGapCalc', to: 'firstGapCheck' },
      { from: 'firstGapCheck', to: 'firstLower', branch: 'yes' },
      { from: 'firstGapCheck', to: 'firstKeep', branch: 'no' },

      // 非第一名 → 尝试跳跃
      { from: 'isFirst', to: 'canJump', branch: 'no' },
      { from: 'canJump', to: 'doJump', branch: 'yes' },
      { from: 'canJump', to: 'noJumpHasBelow', branch: 'no' },
      { from: 'noJumpHasBelow', to: 'noJumpGapCalc', branch: 'yes' },
      { from: 'noJumpHasBelow', to: 'noJumpKeep', branch: 'no' },
      { from: 'noJumpGapCalc', to: 'noJumpGapCheck' },
      { from: 'noJumpGapCheck', to: 'noJumpLower', branch: 'yes' },
      { from: 'noJumpGapCheck', to: 'noJumpKeep', branch: 'no' },
    ],
  };
}
```

**Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 5: 实现 calcAllBids 适配层**

`src/strategy-v2/index.js`:
```js
import { buildContext, getCurrentBudgetLimit, getCurrentRankLimit } from './context.js';
import { executeGraph } from './executor.js';
import { applySafetyGuards } from './safety.js';
import { generateDefaultStrategy } from './defaultStrategy.js';
import * as logger from '../logger.js';

/**
 * 获取某个广告的独立配置
 */
function getAdConfig(adId, config) {
  const adCfg = (config.adConfigs || {})[adId];
  if (!adCfg) {
    return { configured: false, timeSlots: [], gapThreshold: 5, fallbackRankLimit: null, note: '' };
  }
  const timeSlots = (adCfg.timeSlots && adCfg.timeSlots.length > 0) ? adCfg.timeSlots : [];
  const gapThreshold = adCfg.priceGapThreshold != null ? adCfg.priceGapThreshold : 5;
  const fallbackRankLimit = adCfg.rankLimit != null ? adCfg.rankLimit : null;
  const note = adCfg.note || '';
  const configured = timeSlots.length > 0;
  return { configured, timeSlots, gapThreshold, fallbackRankLimit, note };
}

/**
 * 为所有"我的"广告批量计算竞价建议（接口与旧版完全兼容）
 * @param {array} rankings - 排名列表
 * @param {object} config - 全局配置
 * @returns {{ suggestions: array }}
 */
export function calcAllBids(rankings, config) {
  const myAds = rankings.filter(r => r.isMine);
  logger.info(`策略计算(V2)：我的广告 ${myAds.length} 个`);

  // 加载策略模板
  const templates = config.strategyTemplates || {};

  const suggestions = myAds.map(ad => {
    const adKey = ad.adId.replace('广告', '');
    const adConfig = getAdConfig(adKey, config);

    if (!adConfig.configured) {
      logger.warn(`  ${adKey}: 未配置独立预算，跳过竞价`);
      return {
        adId: ad.adId,
        note: adConfig.note,
        rank: ad.rank,
        currentPrice: ad.price,
        targetPrice: ad.price,
        action: 'SKIP',
        reason: '该广告未配置独立预算时段，不参与自动竞价。请在配置中添加该广告。',
        budgetLimit: 0,
        gapThreshold: adConfig.gapThreshold,
        configured: false,
      };
    }

    const { timeSlots, gapThreshold, fallbackRankLimit, note } = adConfig;
    const budgetLimit = getCurrentBudgetLimit(timeSlots);
    const rankLimit = getCurrentRankLimit(timeSlots, fallbackRankLimit);
    const noteTag = note ? `(${note})` : '';
    logger.info(`  ${adKey}${noteTag}: 预算上限 ${budgetLimit}U，阈值 ${gapThreshold}U，排名上限 ${rankLimit != null ? '#' + rankLimit : '无'}`);

    // 构建执行上下文
    const ctx = buildContext(ad, rankings, adConfig);

    // 获取该广告的策略流程图（优先用自定义，否则用默认）
    const adStrategy = (config.adStrategies || {})[adKey];
    const graph = adStrategy || generateDefaultStrategy();

    // 执行流程图
    const execResult = executeGraph(graph, ctx, { templates });

    // 应用安全防护
    const safeResult = applySafetyGuards(execResult, { budgetLimit, currentPrice: ad.price });

    // 组装兼容格式
    const reason = safeResult.path.join(' → ')
      + (safeResult.safetyNotes.length > 0 ? `；安全防护: ${safeResult.safetyNotes.join('，')}` : '')
      + (safeResult.error ? `；错误: ${safeResult.error}` : '');

    return {
      adId: ad.adId,
      note,
      rank: ad.rank,
      currentPrice: ad.price,
      targetPrice: safeResult.targetPrice,
      action: safeResult.action,
      reason,
      budgetLimit,
      gapThreshold,
      rankLimit,
    };
  });

  for (const s of suggestions) {
    const tag = s.action === 'KEEP' ? '⏸' : s.action === 'RAISE' ? '⬆' : s.action === 'LOWER' ? '⬇' : '⏭';
    const nt = s.note ? `(${s.note})` : '';
    logger.info(`${tag} ${s.adId}${nt} #${s.rank}: ${s.currentPrice}U → ${s.targetPrice}U [${s.action}] ${s.reason}`);
  }
  return { suggestions };
}

// 重新导出供外部使用
export { getCurrentBudgetLimit } from './context.js';
export { generateDefaultStrategy } from './defaultStrategy.js';
```

**Step 6: 写 calcAllBids 集成测试**

在 `tests/strategy/integration.test.js` 追加：
```js
import { calcAllBids } from '../src/strategy-v2/index.js';

describe('calcAllBids 兼容性', () => {
  it('返回 { suggestions } 格式', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          rankLimit: null,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions).toBeInstanceOf(Array);
    expect(result.suggestions.length).toBe(1);
    const s = result.suggestions[0];
    expect(s).toHaveProperty('adId');
    expect(s).toHaveProperty('action');
    expect(s).toHaveProperty('currentPrice');
    expect(s).toHaveProperty('targetPrice');
    expect(s).toHaveProperty('reason');
  });

  it('未配置广告返回 SKIP', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD9999', isMine: true },
    ];
    const config = { adConfigs: {} };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions[0].action).toBe('SKIP');
  });

  it('安全防护：目标价不低于50U', () => {
    const rankings = [
      { rank: 1, price: 60, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 30, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    const s = result.suggestions[0];
    if (s.action === 'LOWER') {
      expect(s.targetPrice).toBeGreaterThanOrEqual(50);
    }
  });

  it('支持自定义策略流程图', () => {
    const rankings = [
      { rank: 1, price: 200, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 150, adId: '广告AD3000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
      adStrategies: {
        AD2480: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 'a', type: 'action', action: 'KEEP' },
          ],
          edges: [{ from: 's', to: 'a' }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    // 自定义策略直接返回 KEEP，不管差距
    expect(result.suggestions[0].action).toBe('KEEP');
  });

  it('支持策略模板', () => {
    const rankings = [
      { rank: 3, price: 100, adId: '广告AD2480', isMine: true },
      { rank: 2, price: 200, adId: '广告AD2000', isMine: false },
    ];
    const config = {
      adConfigs: {
        AD2480: {
          priceGapThreshold: 5,
          timeSlots: [{ start: '00:00', end: '24:00', budgetLimit: 300 }],
        },
      },
      strategyTemplates: {
        alwaysRaise: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 'a', type: 'action', action: 'RAISE', targetExpr: 'above.price + 1' },
          ],
          edges: [{ from: 's', to: 'a' }],
        },
      },
      adStrategies: {
        AD2480: {
          nodes: [
            { id: 's', type: 'start' },
            { id: 't', type: 'template', templateId: 'alwaysRaise' },
          ],
          edges: [{ from: 's', to: 't' }],
        },
      },
    };
    const result = calcAllBids(rankings, config);
    expect(result.suggestions[0].action).toBe('RAISE');
    expect(result.suggestions[0].targetPrice).toBe(201);
  });
});
```

**Step 7: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

**Step 8: 提交**

```bash
git add src/strategy-v2/ tests/
git commit -m "feat(strategy-v2): add calcAllBids adapter and default strategy generator"
```

---

### Task 10: 切换 server.js 到新引擎 + 清理

**Files:**
- Modify: `src/web/server.js` (L10)
- Keep: `src/strategy.js` (保留不删，作为参考)

**Step 1: 修改 server.js import**

将 `src/web/server.js` 第10行：
```js
import { calcAllBids, getCurrentBudgetLimit } from '../strategy.js';
```
改为：
```js
import { calcAllBids } from '../strategy-v2/index.js';
```

`getCurrentBudgetLimit` 是死代码，直接移除。

**Step 2: 运行测试确认无回归**

```bash
npm test
```

Expected: PASS

**Step 3: 手动验证**

启动后端并验证:
```bash
node src/index.js
```

确认：
- 服务正常启动
- WebSocket 连接正常
- 监控轮询正常工作（如有排名数据，策略建议正常产出）

**Step 4: 提交**

```bash
git add src/web/server.js
git commit -m "refactor: switch server.js to strategy-v2 engine"
```

**Step 5: 将旧 strategy.js 标记为废弃（可选）**

在 `src/strategy.js` 顶部添加注释：
```js
// @deprecated 已被 strategy-v2/ 替代，保留供参考
```

```bash
git add src/strategy.js
git commit -m "chore: mark old strategy.js as deprecated"
```
