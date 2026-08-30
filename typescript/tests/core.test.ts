import { describe, expect, it } from 'vitest';
import { aggregate, mark, visit } from '../src/core/initializers.js';
import { JSONPC } from '../src/index.js';
import { interpretName } from '../src/walkers/interpret-name.js';
import { _get } from '../src/core/path-map.js';

// Helper function to set comments for a property path
function setComments(jpc: JSONPC, path: string, comments: string[]): void {
  const current = jpc.get(path);
  jpc.set(path, { value: current?.value, comments });
}

// Helper function to get comments for a property path
function getComments(jpc: JSONPC, path: string): string[] | undefined {
  return jpc.get(path)?.comments;
}

describe('core', () => {
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
      expect(interpretName('"foo\\\\bar": 1')).toBe('foo\\\\bar');
    });

    it('should throw on non-property lines', () => {
      expect(() => interpretName('{')).toThrow('Comments are only allowed directly above property names');
      expect(() => interpretName('}')).toThrow('Comments are only allowed directly above property names');
      expect(() => interpretName('[')).toThrow('Comments are only allowed directly above property names');
    });

    it('should throw when colon is missing', () => {
      expect(() => interpretName('"foo"')).toThrow(/Cannot find ending quote/);
    });
  });

  describe('mark', () => {
    it('should convert comments into uuid-named properties with comments as value', () => {
      const input = ['{', ['// comment for x'], '"x": 1', '}'];
      const result = mark(input);
      expect(result.lines[0]).toBe('{');
      expect(result.lines[1].includes('"x')).toBe(true);
      expect(result.lines[1].includes('comment for x')).toBe(true);
      expect(result.lines[2]).toBe('"x": 1');
      expect(result.lines[3]).toBe('}');
      const uuidKey = result.lines[1].match(/"([^"]+)":/)?.[1];
      expect(uuidKey).toBeDefined();
      expect(result.unames.get(uuidKey!)).toBe('x');
    });

    it('should handle multiple comment blocks', () => {
      const input = ['{', ['c1'], '"a": 1,', ['c2'], '"b": 2', '}'];
      const result = mark(input);

      const is = (line: string, key: string) => !line.includes(key) && line.includes(key.slice(0, 2));
      const uuidKeys = result.lines
        .filter((l) => typeof l === 'string' && (is(l, '"a"') || is(l, '"b"')))
        .map(interpretName);

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
      expect(_get(result, ['a'])).toEqual({ b: 2 });
    });

    it('should traverse nested objects and collect uuid-renamed props', () => {
      const obj = { a: { b_uuid: ['// hi'], b: 1 } };
      const names = new Map([['b_uuid', 'b']]);
      const result = visit(obj, names);
      console.log('visit result:', result);
      expect(_get(result, ['a', 'b'])).toEqual(['// hi']);
      expect(obj.a).not.toHaveProperty('b_uuid');
      expect(obj.a).toHaveProperty('b');
    });

    it('should handle empty object', () => {
      const result = visit({}, new Map());
      expect(_get(result, ['anything'])).toBeUndefined();
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
      const comments = getComments(jpc, 'ddd');
      expect(comments).toEqual(['Comment for ddd']);
    });

    it('should return undefined for properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(getComments(jpc, 'nested')).toBeUndefined();
      expect(getComments(jpc, 'nonexistent')).toBeUndefined();
    });

    it('should set comments for an existing property', () => {
      const jpc = new JSONPC(sampleText);
      setComments(jpc, 'ddd', ['Updated comment']);
      expect(getComments(jpc, 'ddd')).toEqual(['Updated comment']);
    });

    it('should set comments for a new property path', () => {
      const jpc = new JSONPC('{"x": 1}');
      setComments(jpc, 'x', ['New comment']);
      expect(getComments(jpc, 'x')).toEqual(['New comment']);
    });

    it('should get and set values', () => {
      const jpc = new JSONPC('{"a": {"b": 1}}');
      expect(jpc.get('a.b')?.value).toBe(1);
      expect(jpc.get('nonexistent')).toBeUndefined();

      jpc.set('a.b', { value: 42 });
      expect(jpc.get('a.b')?.value).toBe(42);
    });

    it('should produce clean object via toObject', () => {
      const jpc = new JSONPC('{"a": 1}');
      const clean = jpc.toObject();
      expect(clean).toEqual({ a: 1 });
    });

    it('should throw on invalid JSON', () => {
      expect(() => new JSONPC('{invalid')).toThrow('Json text being parsed is invalid');
    });

    it('should handle a simple object with no comments', () => {
      const jpc = new JSONPC('{"x": 1, "y": {"z": 2}}');
      expect(jpc.get('x')?.value).toBe(1);
      expect(jpc.get('y.z')?.value).toBe(2);
      expect(jpc.toObject()).toEqual({ x: 1, y: { z: 2 } });
    });
  });
});
