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
