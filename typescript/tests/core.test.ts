import { describe, expect, it } from 'vitest';
import {
  isComment,
  normalizeLines,
  stripTopBottom,
  aggregateComments,
  interpretName,
  uuidName,
  convertCommentsToProperties,
  visit,
} from '../src/core.js';
import { COMMENT_SUFFIX } from '../src/consts.js';
import { JSONWithPropertyComment } from '../src/index.js';

describe('core', () => {
  // ──────────────────────────────────────────────
  // consts.ts
  // ──────────────────────────────────────────────
  describe('COMMENT_SUFFIX', () => {
    it('should be _comments', () => {
      expect(COMMENT_SUFFIX).toBe('_comments');
    });
  });

  // ──────────────────────────────────────────────
  // isComment
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // normalizeLines
  // ──────────────────────────────────────────────
  describe('normalizeLines', () => {
    it('should split text into trimmed non-empty lines', () => {
      const result = normalizeLines('  foo  \n  bar  \n');
      expect(result).toEqual(['foo', 'bar']);
    });

    it('should handle CRLF', () => {
      const result = normalizeLines('a\r\nb\r\n');
      expect(result).toEqual(['a', 'b']);
    });

    it('should filter out empty lines', () => {
      const result = normalizeLines('a\n\n\nb');
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle single line', () => {
      const result = normalizeLines('hello');
      expect(result).toEqual(['hello']);
    });

    it('should handle empty string', () => {
      const result = normalizeLines('');
      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // stripTopBottom
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // aggregateComments
  // ──────────────────────────────────────────────
  describe('aggregateComments', () => {
    it('should aggregate consecutive comments into arrays', () => {
      const lines = ['{', '// c1', '// c2', '"a": 1', '}'];
      const result = aggregateComments(lines);
      expect(result).toEqual(['{', ['// c1', '// c2'], '"a": 1', '}']);
    });

    it('should keep non-comment lines as strings', () => {
      const lines = ['"a":1', '"b":2'];
      const result = aggregateComments(lines);
      expect(result).toEqual(['"a":1', '"b":2']);
    });

    it('should handle single comment line', () => {
      const lines = ['{', '// comment', '"a":1', '}'];
      const result = aggregateComments(lines);
      expect(result).toEqual(['{', ['// comment'], '"a":1', '}']);
    });

    it('should handle empty input', () => {
      expect(aggregateComments([])).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // interpretName
  // ──────────────────────────────────────────────
  describe('interpretName', () => {
    it('should extract a simple property name', () => {
      expect(interpretName('"foo": 1')).toBe('foo');
    });

    it('should handle empty string key', () => {
      expect(interpretName('"": 1')).toBe('');
    });

    it('should handle escaped quotes in key', () => {
      expect(interpretName('"foo\"bar": 1')).toBe('foo"bar');
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

  // ──────────────────────────────────────────────
  // uuidName
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // convertCommentsToProperties
  // ──────────────────────────────────────────────
  describe('convertCommentsToProperties', () => {
    it('should convert comments into _comment properties with uuid names', () => {
      const input = ['{', ['// comment for x'], '"x": 1', '}'];
      const result = convertCommentsToProperties(input);

      // Parse the resulting JSON to verify structure
      const parsed = JSON.parse(result.lines.join(''));

      // Find the uuid key (not _comments key)
      const uuidKey = Object.keys(parsed).find((k) => !k.endsWith(COMMENT_SUFFIX));
      expect(uuidKey).toBeDefined();
      expect(uuidKey).toMatch(/^x_/);

      // Check the comment key
      const commentKey = uuidKey + COMMENT_SUFFIX;
      expect(parsed[commentKey]).toEqual(['// comment for x']);
      expect(parsed[uuidKey as any]).toBe(1);
    });

    it('should handle multiple properties with comments', () => {
      const input = ['{', ['// a comment'], '"a": 1,', ['// b comment'], '"b": 2', '}'];
      const result = convertCommentsToProperties(input);
      const parsed = JSON.parse(result.lines.join(''));

      const keys = Object.keys(parsed).filter((k) => !k.endsWith(COMMENT_SUFFIX));
      expect(keys).toHaveLength(2);
    });

    it('should handle lines without comments as-is', () => {
      const input = ['"x": 1'];
      const result = convertCommentsToProperties(input);
      expect(result.lines).toEqual(['"x": 1']);
      expect(result.names.size).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // visit
  // ──────────────────────────────────────────────
  describe('visit', () => {
    it('should collect prop paths for uuid-named keys', () => {
      const obj = { foo_uuid: 1, foo_uuid_comments: ['// hi'] };
      const names = new Map([['foo_uuid', 'foo']]);
      const result = visit(obj, names);

      expect(result.get(JSON.stringify(['foo']))).toEqual({ origin: 'foo', current: 'foo_uuid' });
    });

    it('should traverse nested objects', () => {
      const obj = { a_uuid: { b: 2 }, a_uuid_comments: ['// a'] };
      const names = new Map([['a_uuid', 'a']]);
      const result = visit(obj, names);

      expect(result.get(JSON.stringify(['a']))).toEqual({ origin: 'a', current: 'a_uuid' });
      expect(result.get(JSON.stringify(['a', 'b']))).toBeUndefined(); // Q11 bug: nested under uuid key not collected
    });

    it('should traverse arrays and collect uuid-renamed props only', () => {
      // visit only collects properties whose keys have been uuid-renamed (with comments)
      // Plain properties without comments are not recorded in the propMap
      const obj = { arr: [{ x: 1 }, { x: 2 }] };
      const names = new Map();
      const result = visit(obj, names);
      expect(result.size).toBe(0);

      // When array elements have uuid-renamed keys, they should be collected
      const names2 = new Map([['x_uuid', 'x']]);
      const obj2 = { arr: [{ x_uuid: 1 }] };
      const result2 = visit(obj2, names2);
      // visit finds arr[0].x_uuid and maps it to origin 'x' at path ['arr', '0', 'x']
      expect(result2.size).toBe(1);
      expect(result2.get(JSON.stringify(['arr', '0', 'x']))).toEqual({ origin: 'x', current: 'x_uuid' });
    });

    it('should handle empty object', () => {
      const result = visit({}, new Map());
      expect(result.size).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // JSONWithPropertyComment (integration)
  // ──────────────────────────────────────────────
  const sampleText = `
// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    "x": 1
  }
}

// Bottom comment
`;

  describe('JSONWithPropertyComment', () => {
    it('should parse and preserve top-level comments', () => {
      const jpc = new JSONWithPropertyComment(sampleText);
      const output = jpc.stringify();
      expect(output).toContain('// Top comment 1');
      expect(output).toContain('// Top comment 2');
      expect(output).toContain('// Bottom comment');
    });

    it('should get comments for a property', () => {
      const jpc = new JSONWithPropertyComment(sampleText);
      const comments = jpc.getComments('ddd');
      expect(comments).toEqual(['// Comment for ddd']);
    });

    it('should return undefined for properties without comments', () => {
      const jpc = new JSONWithPropertyComment(sampleText);
      expect(jpc.getComments('nested')).toBeUndefined();
      expect(jpc.getComments('nonexistent')).toBeUndefined();
    });

    it('should set comments for an existing property', () => {
      const jpc = new JSONWithPropertyComment(sampleText);
      jpc.setComments('ddd', ['// Updated comment']);
      expect(jpc.getComments('ddd')).toEqual(['// Updated comment']);
    });

    it('should set comments for a new property path', () => {
      const jpc = new JSONWithPropertyComment(`{"x": 1}`);
      jpc.setComments('x', ['// New comment']);
      expect(jpc.getComments('x')).toEqual(['// New comment']);
    });

    it('should get and set values', () => {
      const jpc = new JSONWithPropertyComment(`{"a": {"b": 1}}`);
      expect(jpc.get('a.b')).toBe(1);
      expect(jpc.get('nonexistent', 'default')).toBe('default');

      jpc.set('a.b', 42);
      expect(jpc.get('a.b')).toBe(42);
    });

    it('should produce clean JSON via toJSON', () => {
      const jpc = new JSONWithPropertyComment(`{"a": 1}`);
      const clean = jpc.toJSON();
      expect(clean).toEqual({ a: 1 });
    });

    it('should produce clean JSON string via toJSONString', () => {
      const jpc = new JSONWithPropertyComment(`{"a": 1}`);
      const str = jpc.toJSONString();
      expect(str).toBe(JSON.stringify({ a: 1 }));
      const pretty = jpc.toJSONString(null as any, 2);
      expect(pretty).toBe(JSON.stringify({ a: 1 }, null, 2));
      expect(str.replace(/\s/g, '')).toBe(JSON.stringify({ a: 1 }, null, 2).replace(/\s/g, ''));
    });

    it('should preserve round-trip: parse → stringify → parse', () => {
      const jpc = new JSONWithPropertyComment(sampleText);
      const output = jpc.stringify();

      // Parse the output again
      const jpc2 = new JSONWithPropertyComment(output);
      expect(jpc2.getComments('ddd')).toEqual(['// Comment for ddd']);
      expect(jpc2.get('ddd')).toBe(23);
    });

    it('should throw on invalid JSON', () => {
      expect(() => new JSONWithPropertyComment('{invalid')).toThrow('Json text being parsed is invalid');
    });

    it('should handle a simple object with no comments', () => {
      const jpc = new JSONWithPropertyComment('{"x": 1, "y": {"z": 2}}');
      expect(jpc.get('x')).toBe(1);
      expect(jpc.get('y.z')).toBe(2);
      expect(jpc.toJSON()).toEqual({ x: 1, y: { z: 2 } });
    });
  });
});
