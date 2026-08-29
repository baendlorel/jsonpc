import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';

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
      const jpc = new JSONPC('{"x": 1, "y": 2}');
      expect(jpc.get('x')).toBe(1);
      expect(jpc.get('y')).toBe(2);
    });

    it('should handle nested object with no comments', () => {
      const jpc = new JSONPC('{"a": {"b": {"c": 3}}}');
      expect(jpc.get('a.b.c')).toBe(3);
    });

    it('should handle array at root', () => {
      const jpc = new JSONPC('[1, 2, 3]');
      expect(jpc.get('0')).toBe(1);
      expect(jpc.get('2')).toBe(3);
    });
  });

  // ────────────────────────────────────────────
  // topComments / bottomComments
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
      expect(jpc.get('x')).toBe(1);
    });

    it('should work without bottom comments', () => {
      const text = `// top
{
  "x": 1
}`;
      const jpc = new JSONPC(text);
      const output = jpc.stringify();
      expect(output).toContain('// top');
      expect(jpc.get('x')).toBe(1);
    });
  });

  // ────────────────────────────────────────────
  // getComments
  // ────────────────────────────────────────────
  describe('getComments', () => {
    it('should get comment for a property', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.getComments('ddd')).toEqual(['Comment for ddd']);
    });

    it('should return undefined for properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.getComments('nested')).toBeUndefined();
      expect(jpc.getComments('nonexistent')).toBeUndefined();
    });

    it('should return undefined for nested properties without comments', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.getComments('nested.x')).toBeUndefined();
    });

    it('should get comments for nested property', () => {
      const text = `{
  "a": {
    // comment for b
    "b": 1
  }
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('a.b')).toEqual(['comment for b']);
    });

    it('should get multi-line comments', () => {
      const text = `{
  // line 1
  // line 2
  "x": 1
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('x')).toEqual(['line 1', 'line 2']);
    });

    it('should return undefined for non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      expect(jpc.getComments('b')).toBeUndefined();
      expect(jpc.getComments('a.b')).toBeUndefined();
    });

    it('should handle chinese characters in comments', () => {
      const text = `{
  // 这是属性x的注释
  "x": 1
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('x')).toEqual(['这是属性x的注释']);
    });
  });

  // ────────────────────────────────────────────
  // setComments
  // ────────────────────────────────────────────
  describe('setComments', () => {
    it('should set comment for an existing property', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', ['Updated comment']);
      expect(jpc.getComments('ddd')).toEqual(['Updated comment']);
    });

    it('should set multi-line comments for an existing property', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', ['line 1', 'line 2']);
      expect(jpc.getComments('ddd')).toEqual(['line 1', 'line 2']);
    });

    it('should set comment for a property that had no comment before', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('nested', ['Comment for nested']);
      expect(jpc.getComments('nested')).toEqual(['Comment for nested']);
    });

    it('should set comment for a nested property', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('nested.x', ['Comment for x']);
      expect(jpc.getComments('nested.x')).toEqual(['Comment for x']);
    });

    it('should set comment for a non-existent top-level path', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.setComments('b', ['New comment']);
      expect(jpc.getComments('b')).toEqual(['New comment']);
    });

    it('should set comment for a deeply non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.setComments('x.y.z', ['Deep comment']);
      expect(jpc.getComments('x.y.z')).toEqual(['Deep comment']);
    });

    it('should overwrite existing comment', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', ['First']);
      jpc.setComments('ddd', ['Second']);
      expect(jpc.getComments('ddd')).toEqual(['Second']);
    });

    it('should set empty array as comment (clearing)', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', []);
      expect(jpc.getComments('ddd')).toEqual([]);
    });
  });

  // ────────────────────────────────────────────
  // get
  // ────────────────────────────────────────────
  describe('get', () => {
    it('should get top-level property value', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.get('ddd')).toBe(23);
    });

    it('should get nested property value', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.get('nested.x')).toBe(1);
    });

    it('should return default value for non-existent path', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.get('nonexistent', 'default')).toBe('default');
    });

    it('should return undefined for non-existent path without default', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.get('nonexistent')).toBeUndefined();
    });

    it('should get nested object', () => {
      const jpc = new JSONPC(sampleText);
      expect(jpc.get('nested')).toEqual({ x: 1 });
    });

    it('should get null value', () => {
      const jpc = new JSONPC('{"a": null}');
      expect(jpc.get('a')).toBeNull();
    });

    it('should get boolean value', () => {
      const jpc = new JSONPC('{"a": true, "b": false}');
      expect(jpc.get('a')).toBe(true);
      expect(jpc.get('b')).toBe(false);
    });

    it('should get string value', () => {
      const jpc = new JSONPC('{"a": "hello"}');
      expect(jpc.get('a')).toBe('hello');
    });

    it('should get array value', () => {
      const jpc = new JSONPC('{"arr": [1, 2, 3]}');
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });

    it('should get array element by index', () => {
      const jpc = new JSONPC('{"arr": [1, 2, 3]}');
      expect(jpc.get('arr.1')).toBe(2);
    });
  });

  // ────────────────────────────────────────────
  // set
  // ────────────────────────────────────────────
  describe('set', () => {
    it('should set top-level property value', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('ddd', 42);
      expect(jpc.get('ddd')).toBe(42);
    });

    it('should set nested property value', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('nested.x', 99);
      expect(jpc.get('nested.x')).toBe(99);
    });

    it('should set nested object', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('nested', { y: 2 });
      expect(jpc.get('nested')).toEqual({ y: 2 });
    });

    it('should set string value', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('a', 'hello');
      expect(jpc.get('a')).toBe('hello');
    });

    it('should set boolean value', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('a', false);
      expect(jpc.get('a')).toBe(false);
    });

    it('should set null value', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('a', null);
      expect(jpc.get('a')).toBeNull();
    });

    it('should set array value', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('a', [1, 2, 3]);
      expect(jpc.get('a')).toEqual([1, 2, 3]);
    });

    it('should set value for non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('b', 893);
      expect(jpc.get('b')).toBe(893);
    });

    it('should set value for deeply non-existent path', () => {
      const jpc = new JSONPC('{"a": 1}');
      jpc.set('x.y.z', 'deep');
      expect(jpc.get('x.y.z')).toBe('deep');
      expect(jpc.get('x.y')).toEqual({ z: 'deep' });
    });
  });

  // ────────────────────────────────────────────
  // set + getComments interaction
  // ────────────────────────────────────────────
  describe('set / getComments interaction', () => {
    it('should preserve comment after setting value', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('ddd', 99);
      expect(jpc.getComments('ddd')).toEqual(['Comment for ddd']);
    });

    it('should preserve comment after setting nested value', () => {
      const text = `{
  // comment for a
  "a": {
    "b": 1
  }
}`;
      const jpc = new JSONPC(text);
      jpc.set('a', { b: 666 });
      expect(jpc.getComments('a')).toEqual(['comment for a']);
      expect(jpc.get('a.b')).toBe(666);
    });
  });

  // ────────────────────────────────────────────
  // stringify
  // ────────────────────────────────────────────
  describe('stringify', () => {
    it('should produce valid JSON', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      // Extract JSON part (skip top/bottom comments) and verify it's parseable
      const jsonLines = output.split('\n').filter((l) => !l.trim().startsWith('//'));
      const json = jsonLines.join('');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include property comments before the property', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      const lines = output.split('\n');
      // Find the comment line index and verify "ddd" comes after
      const commentIdx = lines.findIndex((l) => l.trim() === '// Comment for ddd');
      expect(commentIdx).toBeGreaterThanOrEqual(0);
      expect(lines[commentIdx + 1].trim()).toContain('"ddd"');
    });

    it('should include property comments after setComments', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('ddd', ['Updated']);
      const output = jpc.stringify();
      expect(output).toContain('// Updated');
      expect(output).not.toContain('// Comment for ddd');
    });

    it('should include new property comments after setComments on non-commented path', () => {
      const jpc = new JSONPC(sampleText);
      jpc.setComments('nested.x', ['New comment']);
      const output = jpc.stringify();
      expect(output).toContain('// New comment');
    });

    it('should respect custom space parameter', () => {
      const jpc = new JSONPC('{"a": 1}');
      const output = jpc.stringify(undefined, 4);
      expect(output).toContain('    "a"');
    });

    it('should skip properties when replacer returns undefined', () => {
      const jpc = new JSONPC('{"a": 1, "b": 2}');
      const replacer = (key: string, val: any) => (key === 'a' ? undefined : val);
      const output = jpc.stringify(replacer);
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ b: 2 });
    });

    it('should stringify after data modifications', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('ddd', 100);
      jpc.setComments('nested', ['New nested comment']);
      const output = jpc.stringify();
      expect(output).toContain('// New nested comment');
      expect(output).toContain('"ddd":100');
    });
  });

  // ────────────────────────────────────────────
  // toJSON
  // ────────────────────────────────────────────
  describe('toJSON', () => {
    it('should return a clean object with original values', () => {
      const jpc = new JSONPC(sampleText);
      const clean = jpc.toObject();
      expect(clean).toEqual({ ddd: 23, nested: { x: 1 } });
    });

    it('should not contain any uuid keys', () => {
      const jpc = new JSONPC(sampleText);
      const clean = jpc.toObject() as Record<string, any>;
      const hasUuidKey = JSON.stringify(clean).includes('_');
      expect(hasUuidKey).toBe(false);
    });

    it('should not contain comment artifacts', () => {
      const jpc = new JSONPC(sampleText);
      const clean = JSON.stringify(jpc.toObject());
      expect(clean).not.toContain('_comments');
      expect(clean).not.toContain('//');
    });

    it('should return updated values after set', () => {
      const jpc = new JSONPC(sampleText);
      jpc.set('ddd', 99);
      expect(jpc.toObject()).toEqual({ ddd: 99, nested: { x: 1 } });
    });

    it('should handle data with arrays', () => {
      const jpc = new JSONPC('{"arr": [1, 2, 3], "obj": {"a": 1}}');
      expect(jpc.toObject()).toEqual({ arr: [1, 2, 3], obj: { a: 1 } });
    });

    it('should handle deep nesting', () => {
      const text = `{
  "a": {
    "b": {
      "c": 3
    }
  }
}`;
      const jpc = new JSONPC(text);
      expect(jpc.toObject()).toEqual({ a: { b: { c: 3 } } });
    });

    it('should not mutate internal data', () => {
      const jpc = new JSONPC(sampleText);
      const clean = jpc.toObject() as Record<string, any>;
      clean.ddd = 999;
      // Internal data unchanged
      expect(jpc.get('ddd')).toBe(23);
    });
  });

  // ────────────────────────────────────────────
  // toJSONString
  // ────────────────────────────────────────────
  describe('toJSONString', () => {
    it('should return compact JSON without spaces', () => {
      const jpc = new JSONPC('{"a": 1}');
      const str = jpc.stringifyWithoutComment();
      expect(JSON.parse(str)).toEqual({ a: 1 });
    });

    it('should return pretty-printed JSON with space param', () => {
      const jpc = new JSONPC('{"a": 1}');
      const pretty = jpc.stringifyWithoutComment(null as any, 2);
      expect(pretty).toBe(JSON.stringify({ a: 1 }, null, 2));
    });

    it('should support replacer', () => {
      const jpc = new JSONPC('{"a": 1, "b": 2}');
      const replacer = (key: string, val: any) => (key === 'a' ? undefined : val);
      const str = jpc.stringifyWithoutComment(replacer as any);
      expect(JSON.parse(str)).toEqual({ b: 2 });
    });

    it('should return no comments', () => {
      const jpc = new JSONPC(sampleText);
      const str = jpc.stringifyWithoutComment();
      expect(str).not.toContain('//');
    });
  });

  // ────────────────────────────────────────────
  // Round-trip
  // ────────────────────────────────────────────
  describe('round-trip', () => {
    it('should preserve comments after parse → stringify → parse', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      const jpc2 = new JSONPC(output);
      expect(jpc2.getComments('ddd')).toEqual(['Comment for ddd']);
      expect(jpc2.get('ddd')).toBe(23);
    });

    it('should preserve top comments in stringify output after round-trip', () => {
      const jpc = new JSONPC(sampleText);
      const output = jpc.stringify();
      expect(output).toContain('// Top comment 1');
      expect(output).toContain('// Bottom comment');
    });

    it('should preserve values after set + round-trip', () => {
      const original = `{"x": 1}`;
      const jpc = new JSONPC(original);
      jpc.set('x', 42);
      jpc.setComments('x', ['answer']);
      const output = jpc.stringify();
      const jpc2 = new JSONPC(output);
      expect(jpc2.get('x')).toBe(42);
      expect(jpc2.getComments('x')).toEqual(['answer']);
    });

    it('should preserve multi-line comments through round-trip', () => {
      const text = `{
  // line one
  // line two
  "x": 1
}`;
      const jpc = new JSONPC(text);
      const output = jpc.stringify();
      const jpc2 = new JSONPC(output);
      expect(jpc2.getComments('x')).toEqual(['line one', 'line two']);
      expect(jpc2.get('x')).toBe(1);
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
      expect(jpc.getComments('a')).toEqual(['a comment']);
      expect(jpc.getComments('b')).toEqual(['b comment']);
    });

    it('should handle special characters in comments', () => {
      const text = `{
  // comment with quotes: "hello"
  "x": 893
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('x')).toEqual(['comment with quotes: "hello"']);
    });

    it('should handle comment with extra leading space after //', () => {
      const text = `{
  //  comment with two spaces
  "x": 1
}`;
      const jpc = new JSONPC(text);
      // stripCommentPrefix removes `//` and one optional space
      // So `//  comment` → ` comment` (one space remains)
      expect(jpc.getComments('x')).toEqual([' comment with two spaces']);
    });

    it('should handle // only (empty comment)', () => {
      const text = `{
  //
  "x": 844
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('x')).toEqual(['']);
    });

    it('should handle object with comments on multiple levels', () => {
      const text = `{
  // top-level comment
  "a": 1,
  "b": {
    // nested comment
    "c": 2
  }
}`;
      const jpc = new JSONPC(text);
      expect(jpc.getComments('a')).toEqual(['top-level comment']);
      expect(jpc.getComments('b.c')).toEqual(['nested comment']);
    });

    it('should handle large number', () => {
      const jpc = new JSONPC('{"n": 999999999}');
      expect(jpc.get('n')).toBe(999999999);
    });

    it('should handle negative number', () => {
      const jpc = new JSONPC('{"n": -42}');
      expect(jpc.get('n')).toBe(-42);
    });

    it('should handle floating point number', () => {
      const jpc = new JSONPC('{"n": 3.14}');
      expect(jpc.get('n')).toBe(3.14);
    });
  });
});
