import { describe, expect, it } from 'vitest';
import {
  isComment,
  trim,
  stripTopBottom,
  aggregate,
  interpretName,
  uuidName,
  mark,
  visit,
  serialize,
} from '../src/core.js';
import { JSONPC } from '../src/index.js';

describe('core', () => {
  describe('isComment', () => {
    it('should return true for // lines', () => {
      expect(isComment('// foo')).toBe(true);
      expect(isComment('//')).toBe(true);
      expect(isComment('// 顶头注释')).toBe(true);
    });

    it('should return false for non-comment lines', () => {
      expect(isComment('"key": 1')).toBe(false);
      expect(isComment('{')).toBe(false);
      expect(isComment('}')).toBe(false);
      expect(isComment('')).toBe(false);
    });
  });

  describe('trim', () => {
    it('should split text into trimmed non-empty lines', () => {
      const result = trim('  foo  \n  bar  \n');
      expect(result).toEqual(['foo', 'bar']);
    });

    it('should handle CRLF', () => {
      const result = trim('a\r\nb\r\n');
      expect(result).toEqual(['a', 'b']);
    });

    it('should filter out empty lines', () => {
      const result = trim('a\n\n\nb');
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle single line', () => {
      const result = trim('hello');
      expect(result).toEqual(['hello']);
    });

    it('should handle empty string', () => {
      const result = trim('');
      expect(result).toEqual([]);
    });
  });

  describe('stripTopBottom', () => {
    it('should strip top and bottom comments', () => {
      const lines = ['// top1', '// top2', '"a":1', '"b":2', '// bottom1'];
      const result = stripTopBottom(lines);
      expect(result.top).toBe(1);
      expect(result.bottom).toBe(4);
    });

    it('should return NaN when there are no top/bottom comments', () => {
      const lines = ['"a":1', '"b":2'];
      const result = stripTopBottom(lines);
      expect(Number.isNaN(result.top)).toBe(true);
      expect(Number.isNaN(result.bottom)).toBe(true);
    });

    it('should handle only top comments', () => {
      const lines = ['// top', '"a":1'];
      const result = stripTopBottom(lines);
      expect(result.top).toBe(0);
      expect(Number.isNaN(result.bottom)).toBe(true);
    });

    it('should handle only bottom comments', () => {
      const lines = ['"a":1', '// bottom'];
      const result = stripTopBottom(lines);
      expect(Number.isNaN(result.top)).toBe(true);
      expect(result.bottom).toBe(1);
    });

    it('should handle empty array', () => {
      const result = stripTopBottom([]);
      expect(Number.isNaN(result.top)).toBe(true);
      expect(Number.isNaN(result.bottom)).toBe(true);
    });
  });

  describe('aggregate', () => {
    it('should aggregate consecutive comments into arrays', () => {
      const lines = ['{', '// c1', '// c2', '"a": 1', '}'];
      const result = aggregate(lines);
      expect(result).toEqual(['{', ['c1', 'c2'], '"a": 1', '}']);
    });

    it('should keep non-comment lines as strings', () => {
      const lines = ['"a":1', '"b":2'];
      const result = aggregate(lines);
      expect(result).toEqual(['"a":1', '"b":2']);
    });

    it('should handle single comment line', () => {
      const lines = ['{', '// comment', '"a":1', '}'];
      const result = aggregate(lines);
      expect(result).toEqual(['{', ['comment'], '"a":1', '}']);
    });

    it('should handle empty input', () => {
      expect(aggregate([])).toEqual([]);
    });
  });

  describe('interpretName', () => {
    it('should extract a simple property name', () => {
      expect(interpretName('"foo": 1')).toBe('foo');
    });

    it('should handle empty string key', () => {
      expect(interpretName('"": 1')).toBe('');
    });

    it('should handle escaped backslash in key', () => {
      // The current implementation skips escaped characters (including \")
      // so the quote is not included in the output
      expect(interpretName('"foo\\\\bar": 1')).toBe('foo\\bar');
    });

    it('should throw on non-property lines', () => {
      expect(() => interpretName('{')).toThrow('Comments are only allowed directly above property names');
      expect(() => interpretName('}')).toThrow('Comments are only allowed directly above property names');
      expect(() => interpretName('[')).toThrow('Comments are only allowed directly above property names');
    });

    it('should throw when colon is missing', () => {
      expect(() => interpretName('"foo"')).toThrow(/Cannot find 2nd/);
    });
  });

  describe('uuidName', () => {
    it('should append an underscore and UUID to the origin', () => {
      const result = uuidName('foo');
      expect(result).toMatch(/^foo_[0-9a-f-]{36}$/);
    });

    it('should generate unique values', () => {
      const a = uuidName('x');
      const b = uuidName('x');
      expect(a).not.toBe(b);
    });
  });

  describe('mark', () => {
    it('should convert comments into uuid-named properties with comments as value', () => {
      const input = ['{', ['// comment for x'], '"x": 1', '}'];
      const result = mark(input);
      expect(result.lines[0]).toBe('{');
      expect(result.lines[1]).toMatch(/"x_[0-9a-f-]{36}":\["\/\/ comment for x"\],/);
      expect(result.lines[2]).toBe('"x": 1');
      expect(result.lines[3]).toBe('}');
      const uuidKey = result.lines[1].match(/"([^"]+)":/)?.[1];
      expect(uuidKey).toBeDefined();
      expect(result.unames.get(uuidKey!)).toBe('x');
    });

    it('should handle multiple comment blocks', () => {
      const input = ['{', ['c1'], '"a": 1,', ['c2'], '"b": 2', '}'];
      const result = mark(input);
      const uuidKeys = result.lines
        .filter((l) => typeof l === 'string' && l.includes('_'))
        .map((l) => l.match(/"([^"]+)":/)?.[1])
        .filter(Boolean);
      expect(uuidKeys).toHaveLength(2);
      expect(result.unames.get(uuidKeys[0]!)).toBe('a');
      expect(result.unames.get(uuidKeys[1]!)).toBe('b');
    });

    it('should handle empty input', () => {
      const result = mark([]);
      expect(result.lines).toEqual([]);
      expect(result.unames.size).toBe(0);
    });

    it('should handle lines without comments', () => {
      const input = ['{', '"a": 1', '}'];
      const result = mark(input);
      expect(result.lines).toEqual(input);
      expect(result.unames.size).toBe(0);
    });
  });

  describe('visit', () => {
    it('should collect uuid-named keys into the path map and delete them from obj', () => {
      const obj = { a_uuid: { b: 2 }, a: { b: 2 } };
      const names = new Map([['a_uuid', 'a']]);
      const result = visit(obj, names);
      expect(obj).not.toHaveProperty('a_uuid');
      expect(obj).toHaveProperty('a');
      expect(result.get(['a'])).toEqual({ b: 2 });
    });

    it('should traverse nested objects and collect uuid-renamed props', () => {
      const obj = { a: { b_uuid: ['// hi'], b: 1 } };
      const names = new Map([['b_uuid', 'b']]);
      const result = visit(obj, names);
      expect(result.get(['a', 'b'])).toEqual(['// hi']);
      expect(obj.a).not.toHaveProperty('b_uuid');
      expect(obj.a).toHaveProperty('b');
    });

    it('should handle empty object', () => {
      const result = visit({}, new Map());
      expect(result.get(['anything'])).toBeUndefined();
    });
  });

  describe('JSONPC integration', () => {
    const sampleText = `
// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 808,
  "nested": {
    "x": 893
  }
}

// Bottom comment
`;

    it('should parse and preserve top-level comments', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      expect(output).toContain('// Top comment 1');
      expect(output).toContain('// Top comment 2');
      expect(output).toContain('// Bottom comment');
    });

    it('should get comments for a property', () => {
      const jpc = new JSONPC(sampleText);
      const comments = jpc.getComments('ddd');
      expect(comments).toEqual(['Comment for ddd']);
    });

    it('should return undefined for properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.getComments('nested')).toBeUndefined();
      expect(jpc.getComments('nonexistent')).toBeUndefined();
    });

    it('should set comments for an existing property', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', ['Updated comment']);
      expect(jpc.getComments('ddd')).toEqual(['Updated comment']);
    });

    it('should set comments for a new property path', () => {
      const jpc = new JSONPC('{"x": 1}');
      jpc.setComments('x', ['New comment']);
      expect(jpc.getComments('x')).toEqual(['New comment']);
    });

    it('should get and set values', () => {
      const jpc = new JSONPC('{"a": {"b": 1}}');
      expect(jpc.get('a.b')).toBe(1);
      expect(jpc.get('nonexistent', 'default')).toBe('default');

      jpc.set('a.b', 42);
      expect(jpc.get('a.b')).toBe(42);
    });

    it('should produce clean object via toObject', () => {
      const jpc = new JSONPC('{"a": 1}');
      const clean = jpc.toObject();
      expect(clean).toEqual({ a: 1 });
    });

    it('should produce clean JSON string via stringifyWithoutComment', () => {
      const jpc = new JSONPC('{"a": 1}');
      const str = jpc.stringifyWithoutComment();
      expect(JSON.parse(str)).toEqual({ a: 1 });
      const pretty = jpc.stringifyWithoutComment(null, 2);
      expect(pretty).toBe(JSON.stringify({ a: 1 }, null, 2));
    });

    it('should throw on invalid JSON', () => {
      expect(() => new JSONPC('{invalid')).toThrow('Json text being parsed is invalid');
    });

    it('should handle a simple object with no comments', () => {
      const jpc = new JSONPC('{"x": 1, "y": {"z": 2}}');
      expect(jpc.get('x')).toBe(1);
      expect(jpc.get('y.z')).toBe(2);
      expect(jpc.toObject()).toEqual({ x: 1, y: { z: 2 } });
    });
  });
});
