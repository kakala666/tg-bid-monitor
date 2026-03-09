import { describe, it, expect } from 'vitest';
import { tokenize, parse } from '../../src/strategy-v2/expr.js';

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
