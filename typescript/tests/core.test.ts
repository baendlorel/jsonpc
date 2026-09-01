import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/core/initializers.js';
import { JSONPC } from '../src/index.js';
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
      expect(getComments(jpc, 'nested')).toEqual([]);
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
      expect(() => new JSONPC('{invalid')).toThrow(/Expected property name or '}'/);
    });

    it('should handle a simple object with no comments', () => {
      const jpc = new JSONPC('{"x": 1, "y": {"z": 2}}');
      expect(jpc.get('x')?.value).toBe(1);
      expect(jpc.get('y.z')?.value).toBe(2);
      expect(jpc.toObject()).toEqual({ x: 1, y: { z: 2 } });
    });
  });
});
