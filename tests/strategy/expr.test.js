import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/strategy-v2/expr.js';

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
