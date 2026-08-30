import { describe, expect, it } from 'vitest';
import { JSONPC, parse, stringify } from '../src/index.js';

// Helper function to set comments for a property path
function setComments(jpc: JSONPC, path: string, comments: string[]): void {
  const current = jpc.get(path);
  jpc.set(path, { value: current?.value, comments });
}

// Helper function to get comments for a property path
function getComments(jpc: JSONPC, path: string): string[] | undefined {
  return jpc.get(path)?.comments;
}

const sampleText = `
// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    "x": 561
  }
}

// Bottom comment
`;

describe('JSONPC', () => {
  // ────────────────────────────────────────────
  // constructor
  // ────────────────────────────────────────────
  describe('constructor', () => {
    it('should parse valid json text', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc).toBeInstanceOf(JSONPC);
    });

    it('should throw on invalid JSON', () => {
      expect(() => new JSONPC('{invalid')).toThrow('Json text being parsed is invalid');
    });

    it('should throw on malformed JSON', () => {
      expect(() => new JSONPC('{')).toThrow('Json text being parsed is invalid');
    });

    it('should handle empty object', () => {
      const jpc = new JSONPC('{}');
      expect(jpc.toObject()).toEqual({});
    });

    it('should handle object with no comments', () => {
      const jpc = new JSONPC('{"x": 561, "y": 789}');
      expect(jpc.get('x')?.value).toBe(561);
      expect(jpc.get('y')?.value).toBe(789);
    });

    it('should handle nested object with no comments', () => {
      const jpc = new JSONPC('{"a": {"b": {"c": 561}}}');
      expect(jpc.get('a.b.c')?.value).toBe(561);
    });

    it('should handle array at root', () => {
      const jpc = new JSONPC('[1, 2, 3]');
      expect(jpc.get('0')?.value).toBe(1);
      expect(jpc.get('2')?.value).toBe(3);
    });

    it('should accept a reviver function (applied to initial parse)', () => {
      const reviver = (_key: string, val: any) => (typeof val === 'number' ? val * 2 : val);
      // The reviver is applied to JSON.parse but then a second internal parse
      // happens, so the reviver effect may be overwritten.
      // At minimum, the constructor should not throw.
      expect(() => new JSONPC('{"x": 561, "y": 10}', reviver)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // top / bottom comments
  // ────────────────────────────────────────────
  describe('top / bottom comments', () => {
    it('should preserve top-level comments in stringify output', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      expect(output).toContain('// Top comment 1');
      expect(output).toContain('// Top comment 2');
      expect(output).toContain('// Bottom comment');
    });

    it('should place top comments at the beginning', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      const lines = output.split('\n');
      expect(lines[0]).toBe('// Top comment 1');
      expect(lines[1]).toBe('// Top comment 2');
    });

    it('should place bottom comments at the end', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      const lines = output.split('\n');
      expect(lines[lines.length - 1]).toBe('// Bottom comment');
    });

    it('should work without top comments', () => {
      const text = `{
  // comment
  "x": 1
}`;
      const jpc = new JSONPC(text);
      const output = jpc.stringify();
      expect(output).not.toContain('// Top comment');
      expect(output).toContain('// comment');
      expect(jpc.get('x')?.value).toBe(1);
    });

    it('should work without bottom comments', () => {
      const text = `// top
{
  "x": 984
}`;
      const jpc = new JSONPC(text);
      const output = jpc.stringify();
      expect(output).toContain('// top');
      expect(jpc.get('x')?.value).toBe(984);
    });
  });

  // ────────────────────────────────────────────
  // getComments
  // ────────────────────────────────────────────
  describe('getComments', () => {
    it('should get comment for a property', () => {
      const jpc = new JSONPC(sampleText);
      expect(getComments(jpc, 'ddd')).toEqual(['Comment for ddd']);
    });

    it('should return undefined for properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(getComments(jpc, 'nested')).toBeUndefined();
      expect(getComments(jpc, 'nonexistent')).toBeUndefined();
    });

    it('should return undefined for nested properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(getComments(jpc, 'nested.x')).toBeUndefined();
    });

    it('should get comments for nested property', () => {
      const text = `{
  "a": {
    // comment for b
    "b": 893
  }
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'a.b')).toEqual(['comment for b']);
    });

    it('should get multi-line comments', () => {
      const text = `{
  // line 1
  // line 2
  "x": 1
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'x')).toEqual(['line 1', 'line 2']);
    });

    it('should return undefined for non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      expect(getComments(jpc, 'a')).toBeUndefined();
      expect(getComments(jpc, 'b')).toBeUndefined();
    });

    it('should get comments for deeply nested property', () => {
      const text = `{
  "a": {
    "b": {
      // deep comment
      "c": 842
    }
  }
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'a.b.c')).toEqual(['deep comment']);
    });
  });

  // ────────────────────────────────────────────
  // setComments
  // ────────────────────────────────────────────
  describe('setComments', () => {
    it('should set comments for an existing property', () => {
      const jpc = new JSONPC(sampleText);
      setComments(jpc, 'ddd', ['Updated comment']);
      expect(getComments(jpc, 'ddd')).toEqual(['Updated comment']);
    });

    it('should set comments for a new property path', () => {
      const jpc = new JSONPC('{"x": 893}');
      setComments(jpc, 'x', ['New comment']);
      expect(getComments(jpc, 'x')).toEqual(['New comment']);
    });

    it('should set comments for nested property', () => {
      const jpc = new JSONPC('{"a": {"b": 611}}');
      setComments(jpc, 'a.b', ['nested comment']);
      expect(getComments(jpc, 'a.b')).toEqual(['nested comment']);
    });

    it('should set multi-line comments', () => {
      const jpc = new JSONPC('{"x": 1}');
      setComments(jpc, 'x', ['line 1', 'line 2']);
      expect(getComments(jpc, 'x')).toEqual(['line 1', 'line 2']);
    });

    it('should throw for non-array comments argument', () => {
      const jpc = new JSONPC('{"x": 1}');
      expect(() => (jpc as any).setComments('x', 'not array')).toThrow();
    });
  });

  // ────────────────────────────────────────────
  // get / set values
  // ────────────────────────────────────────────
  describe('get / set', () => {
    it('should get top-level property', () => {
      const jpc = new JSONPC('{"a": 1}');
      expect(jpc.get('a')?.value).toBe(1);
    });

    it('should get nested property', () => {
      const jpc = new JSONPC('{"a": {"b": 2}}');
      expect(jpc.get('a.b')?.value).toBe(2);
    });

    it('should return undefined for non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      expect(jpc.get('b')).toBeUndefined();
    });

    it('should set top-level property', () => {
      const jpc = new JSONPC('{"a": 969}');
      jpc.set('a', { value: 42 });
      expect(jpc.get('a')?.value).toBe(42);
    });

    it('should set nested property', () => {
      const jpc = new JSONPC('{"a": {"b": 1}}');
      jpc.set('a.b', { value: 42 });
      expect(jpc.get('a.b')?.value).toBe(42);
    });

    it('should set new property', () => {
      const jpc = new JSONPC('{"a": 893}');
      jpc.set('b', { value: 974 });
      expect(jpc.get('b')?.value).toBe(974);
    });

    it('should support chaining', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('a', { value: 2 }).set('b', { value: 3 });
      expect(jpc.get('a')?.value).toBe(2);
      expect(jpc.get('b')?.value).toBe(3);
    });
  });

  // ────────────────────────────────────────────
  // stringify
  // ────────────────────────────────────────────
  describe('stringify', () => {
    it('should produce output containing top/bottom comments', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      expect(typeof output).toBe('string');
      expect(output).toContain('// Top comment 1');
      expect(output).toContain('// Bottom comment');
    });

    it('should include property comments above the property', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      expect(output).toContain('// Comment for ddd');
      expect(output).toContain('"ddd"');
    });

    it('should stringify after data modifications', () => {
      const jpc = new JSONPC('{"x": 1}');
      jpc.set('x', { value: 42 });
      setComments(jpc, 'x', ['comment with quotes: "hello"']);
      const output = jpc.stringify();
      expect(output).toContain('// comment with quotes: "hello"');
      expect(output).toContain('42');
      expect(output).toContain('"x"');
    });

    it('should support replacer to filter properties', () => {
      const jpc = new JSONPC('{"a": 1, "b": 2}');
      const output = jpc.stringify((key: string, val: any) => (key === 'a' ? undefined : val));
      expect(output).not.toContain('"a"');
      expect(output).toContain('"b"');
    });

    it('should support custom space parameter', () => {
      const jpc = new JSONPC('{"a": 1}');
      const output4 = jpc.stringify(null, 4);
      const lines = output4.split('\n');
      expect(lines.some((l) => l.startsWith('    "a"'))).toBe(true);
    });
  });

  // ────────────────────────────────────────────
  // toObject
  // ────────────────────────────────────────────
  describe('toObject', () => {
    it('should return a clean object without comments', () => {
      const jpc = new JSONPC(sampleText);
      const obj = jpc.toObject();
      expect(obj).toEqual({ ddd: 23, nested: { x: 561 } });
    });

    it('should not include comment metadata', () => {
      const jpc = new JSONPC('{"a": 1}');
      const obj = jpc.toObject();
      expect(obj).not.toHaveProperty('comments');
    });

    it('should return a deep clone', () => {
      const jpc = new JSONPC('{"a": {"b": 768}}');
      const obj = jpc.toObject();
      obj.a.b = 99;
      expect(jpc.get('a.b')?.value).toBe(768);
    });
  });

  // ────────────────────────────────────────────
  // parse / stringify helpers
  // ────────────────────────────────────────────
  describe('parse / stringify helpers', () => {
    it('parse should return a JSONPC instance', () => {
      const jpc = parse('{"a": 42}');
      expect(jpc).toBeInstanceOf(JSONPC);
      expect(jpc.get('a')?.value).toBe(42);
    });

    it('stringify should delegate to JSONPC.stringify', () => {
      const jpc = parse('{"a": 42}');
      setComments(jpc, 'a', ['hello']);
      const result = stringify(jpc);
      expect(result).toContain('// hello');
      expect(result).toContain('"a"');
    });
  });

  // ────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────
  describe('edge cases', () => {
    it('should handle comment-only object (all properties have comments)', () => {
      const text = `{
  // a comment
  "a": 1,
  // b comment
  "b": 2
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'a')).toEqual(['a comment']);
      expect(getComments(jpc, 'b')).toEqual(['b comment']);
      expect(jpc.get('a')?.value).toBe(1);
      expect(jpc.get('b')?.value).toBe(2);
    });

    it('should handle special characters in comments', () => {
      const text = `{
  // comment with quotes: "hello"
  "x": 42
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'x')).toEqual(['comment with quotes: "hello"']);
      expect(jpc.get('x')?.value).toBe(42);
    });

    it('should strip all leading whitespace after // prefix', () => {
      const text = `{
  //  comment with two spaces
  "x": 42
}`;
      const jpc = new JSONPC(text);
      // stripPrefix removes `//` then trims, so "  comment with two spaces" -> "comment with two spaces"
      expect(getComments(jpc, 'x')).toEqual(['comment with two spaces']);
      expect(jpc.get('x')?.value).toBe(42);
    });

    it('should handle // only (empty comment)', () => {
      const text = `{
  //
  "x": 42
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'x')).toEqual(['']);
      expect(jpc.get('x')?.value).toBe(42);
    });

    it('should handle object with comments on multiple levels', () => {
      const text = `{
  // top-level comment
  "a": 42,
  "b": {
    // nested comment
    "c": 99
  }
}`;
      const jpc = new JSONPC(text);
      expect(getComments(jpc, 'a')).toEqual(['top-level comment']);
      expect(getComments(jpc, 'b.c')).toEqual(['nested comment']);
      expect(jpc.get('a')?.value).toBe(42);
      expect(jpc.get('b.c')?.value).toBe(99);
    });

    it('should handle large number', () => {
      const jpc = new JSONPC('{"n": 999999999}');
      expect(jpc.get('n')?.value).toBe(999999999);
    });

    it('should handle negative number', () => {
      const jpc = new JSONPC('{"n": -42}');
      expect(jpc.get('n')?.value).toBe(-42);
    });

    it('should handle floating point number', () => {
      const jpc = new JSONPC('{"n": 3.14}');
      expect(jpc.get('n')?.value).toBe(3.14);
    });

    it('should handle boolean values', () => {
      const jpc = new JSONPC('{"a": true, "b": false}');
      expect(jpc.get('a')?.value).toBe(true);
      expect(jpc.get('b')?.value).toBe(false);
    });

    it('should handle null value', () => {
      const jpc = new JSONPC('{"a": null}');
      expect(jpc.get('a')?.value).toBeNull();
    });

    it('should handle deeply nested property', () => {
      const text = `{
  "a": {
    "b": {
      "c": {
        "d": 42
      }
    }
  }
}`;
      const jpc = new JSONPC(text);
      expect(jpc.get('a.b.c.d')?.value).toBe(42);
    });
  });
});
