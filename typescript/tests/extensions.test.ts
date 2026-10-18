import { describe, expect, it } from 'vitest';
import { JSONPC, parse } from '../src/index.js';

/**
 * JSONPC extensions: `NaN`, bare ISO `Date` literals and BigInt (`42n`).
 * They are written without quotes, like JSON5, but stay inside the
 * comment-preserving `JSONPC` pipeline.
 */

describe('extensions: parse', () => {
  it('should parse bare NaN', () => {
    const jpc = new JSONPC('{"a": NaN}');
    const obj = jpc.toObject();
    expect(Number.isNaN(obj.a)).toBe(true);
  });

  it('should parse NaN nested in arrays and objects', () => {
    const jpc = parse('{"arr": [1, NaN, {"x": NaN}]}');
    const obj = jpc.toObject();
    expect(obj.arr[0]).toBe(1);
    expect(Number.isNaN(obj.arr[1])).toBe(true);
    expect(Number.isNaN(obj.arr[2].x)).toBe(true);
  });

  it('should parse a bare ISO date literal', () => {
    const jpc = new JSONPC('{"d": 2024-01-02T03:04:05.678Z}');
    const obj = jpc.toObject();
    expect(obj.d).toBeInstanceOf(Date);
    expect(obj.d.toISOString()).toBe('2024-01-02T03:04:05.678Z');
  });

  it('should parse a bare BigInt literal', () => {
    const jpc = new JSONPC('{"big": 9007199254740993n}');
    expect(jpc.toObject().big).toBe(9007199254740993n);
  });

  it('should parse a negative BigInt literal', () => {
    const jpc = new JSONPC('{"big": -42n}');
    expect(jpc.toObject().big).toBe(-42n);
  });

  it('should not translate quoted look-alikes', () => {
    const jpc = new JSONPC(
      '{"a": "NaN", "b": "2024-01-02T03:04:05.678Z", "c": "42n"}',
    );
    expect(jpc.toObject()).toEqual({
      a: 'NaN',
      b: '2024-01-02T03:04:05.678Z',
      c: '42n',
    });
  });

  it('should keep comments alongside extension values', () => {
    const text = `
{
  // special numbers
  "nan": NaN,
  "date": 2024-01-02T03:04:05.678Z,
  "big": 42n
}`;
    const jpc = parse(text);
    expect(jpc.get('nan')?.comments).toEqual(['special numbers']);
    expect(Number.isNaN(jpc.get('nan')?.value)).toBe(true);
    expect(jpc.get('date')?.value).toBeInstanceOf(Date);
    expect(jpc.get('big')?.value).toBe(42n);
  });

  it('should expose the extension values through get()', () => {
    const jpc = parse('{"nan": NaN, "big": 42n}');
    expect(Number.isNaN(jpc.get('nan')?.value)).toBe(true);
    expect(jpc.get('big')?.value).toBe(42n);
  });
});

describe('extensions: stringify', () => {
  it('should emit bare NaN', () => {
    const jpc = new JSONPC('{}');
    jpc.set('nan', { value: NaN });
    expect(jpc.stringify().trim()).toBe('{\n  "nan": NaN,\n}');
  });

  it('should emit a bare ISO date', () => {
    const jpc = new JSONPC('{}');
    jpc.set('d', { value: new Date('2024-01-02T03:04:05.678Z') });
    expect(jpc.stringify().trim()).toBe('{\n  "d": 2024-01-02T03:04:05.678Z,\n}');
  });

  it('should emit a bare BigInt', () => {
    const jpc = new JSONPC('{}');
    jpc.set('big', { value: 42n });
    expect(jpc.stringify().trim()).toBe('{\n  "big": 42n,\n}');
  });

  it('should emit extensions inside arrays', () => {
    const jpc = new JSONPC('{}');
    jpc.set('arr', { value: [NaN, new Date('2024-01-02T03:04:05.678Z'), 42n] });
    expect(jpc.stringify().trim()).toBe(
      '{\n  "arr": [\n    NaN,\n    2024-01-02T03:04:05.678Z,\n    42n,\n  ],\n}',
    );
  });

  it('should round-trip through parse(stringify())', () => {
    const jpc = new JSONPC('{}');
    jpc.set('data', {
      value: {
        nan: NaN,
        date: new Date('2024-01-02T03:04:05.678Z'),
        big: 42n,
        nested: [NaN, { big: -7n }],
      },
    });

    const again = parse(jpc.stringify());
    const obj = again.toObject();
    expect(Number.isNaN(obj.data.nan)).toBe(true);
    expect(obj.data.date).toBeInstanceOf(Date);
    expect(obj.data.date.toISOString()).toBe('2024-01-02T03:04:05.678Z');
    expect(obj.data.big).toBe(42n);
    expect(Number.isNaN(obj.data.nested[0])).toBe(true);
    expect(obj.data.nested[1].big).toBe(-7n);
  });
});

describe('extensions: toObject', () => {
  it('should convert all extensions to real JS values', () => {
    const jpc = parse(
      '{"nan": NaN, "date": 2024-01-02T03:04:05.678Z, "big": 42n, "plain": 1}',
    );
    const obj = jpc.toObject();

    expect(Number.isNaN(obj.nan)).toBe(true);
    expect(obj.date).toBeInstanceOf(Date);
    expect(obj.big).toBe(42n);
    expect(obj.plain).toBe(1);
  });

  it('should work after set() with extension values', () => {
    const jpc = parse('{"a": 1}');
    jpc.set('nan', { value: NaN });
    jpc.set('date', { value: new Date('2024-01-02T03:04:05.678Z') });
    jpc.set('big', { value: 42n });

    const obj = jpc.toObject();
    expect(obj.a).toBe(1);
    expect(Number.isNaN(obj.nan)).toBe(true);
    expect(obj.date.toISOString()).toBe('2024-01-02T03:04:05.678Z');
    expect(obj.big).toBe(42n);
  });

  it('should throw on invalid extension syntax', () => {
    expect(() => new JSONPC('{"a": 12nn}')).toThrow();
    expect(() => new JSONPC('{"a": nan}')).toThrow();
  });
});
