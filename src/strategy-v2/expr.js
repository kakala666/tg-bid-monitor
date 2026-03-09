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
