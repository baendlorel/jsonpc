import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';

/**
 * NOTE: The current parser does NOT support placing comments before array element values
 * in source text (e.g. `[// comment\n  1]`). Comments can only appear before object
 * property names (`"key": value`).
 *
 * We set comments programmatically via `setComments()` after parsing to test
 * that commentMap stays in sync with array operations.
 */

function makeArrJPC(arr: any[]) {
  return new JSONPC(JSON.stringify({ arr }));
}

// Helper function to set comments for a property path
function setComments(jpc: JSONPC, path: string, comments: string[]): void {
  const current = jpc.get(path);
  jpc.set(path, { value: current?.value, comments });
}

// Helper function to get comments for a property path
function getComments(jpc: JSONPC, path: string): string[] | undefined {
  return jpc.get(path)?.comments;
}

describe('Array operations with commentsMap synchronization', () => {
  describe('push', () => {
    it('should not affect existing comments when pushing elements', () => {
      const jpc = makeArrJPC([1, 2]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);

      jpc.updateArray('arr', 'push', [3]);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')?.value).toEqual([1, 2, 3]);
    });
  });

  describe('pop', () => {
    it('should remove comments for the popped element', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'pop', []);

      expect(getComments(jpc, 'arr.2')).toBeUndefined();
      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')?.value).toEqual([1, 2]);
    });

    it('should work with nested path', () => {
      const jpc = new JSONPC('{"data": {"items": [1, 2, 3]}}');
      setComments(jpc, 'data.items.0', ['first']);
      setComments(jpc, 'data.items.1', ['second']);
      setComments(jpc, 'data.items.2', ['third']);

      jpc.updateArray('data.items', 'pop', []);

      expect(getComments(jpc, 'data.items.2')).toBeUndefined();
      expect(getComments(jpc, 'data.items.0')).toEqual(['first']);
      expect(getComments(jpc, 'data.items.1')).toEqual(['second']);
      expect(jpc.get('data.items')?.value).toEqual([1, 2]);
    });
  });

  describe('shift', () => {
    it('should shift all comments and remove first element comments', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'shift', []);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 1']);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 2']);
      expect(getComments(jpc, 'arr.2')).toBeUndefined();
      expect(jpc.get('arr')?.value).toEqual([2, 3]);
    });
  });

  describe('unshift', () => {
    it('should shift all comments to make room for new element', () => {
      const jpc = makeArrJPC([1, 2]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);

      jpc.updateArray('arr', 'unshift', [0]);

      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.2')).toEqual(['comment for 1']);
      expect(getComments(jpc, 'arr.0')).toBeUndefined();
      expect(jpc.get('arr')?.value).toEqual([0, 1, 2]);
    });
  });

  describe('splice', () => {
    it('should handle splice delete without insert', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);
      setComments(jpc, 'arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'splice', [1, 2]);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 3']);
      expect(getComments(jpc, 'arr.2')).toBeUndefined();
      expect(jpc.get('arr')?.value).toEqual([1, 4]);
    });

    it('should handle splice insert without delete', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'splice', [1, 0, 'a', 'b']);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.3')).toEqual(['comment for 1']);
      expect(getComments(jpc, 'arr.4')).toEqual(['comment for 2']);
      expect(getComments(jpc, 'arr.1')).toBeUndefined();
      expect(getComments(jpc, 'arr.2')).toBeUndefined();
      expect(jpc.get('arr')?.value).toEqual([1, 'a', 'b', 2, 3]);
    });

    it('should handle splice with both delete and insert', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);
      setComments(jpc, 'arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'splice', [1, 1, 'a', 'b']);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getComments(jpc, 'arr.3')).toEqual(['comment for 2']); // Original index 2 moves to index 3
      expect(getComments(jpc, 'arr.4')).toEqual(['comment for 3']); // Original index 3 moves to index 4
      expect(getComments(jpc, 'arr.1')).toBeUndefined(); // Newly inserted 'a'
      expect(getComments(jpc, 'arr.2')).toBeUndefined(); // Newly inserted 'b'
      expect(jpc.get('arr')?.value).toEqual([1, 'a', 'b', 3, 4]);
    });
  });

  describe('reverse', () => {
    it('should reverse the comment mapping for array elements', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      setComments(jpc, 'arr.0', ['comment for 0']);
      setComments(jpc, 'arr.1', ['comment for 1']);
      setComments(jpc, 'arr.2', ['comment for 2']);
      setComments(jpc, 'arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'reverse', []);

      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 3']);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 2']);
      expect(getComments(jpc, 'arr.2')).toEqual(['comment for 1']);
      expect(getComments(jpc, 'arr.3')).toEqual(['comment for 0']);
      expect(jpc.get('arr')?.value).toEqual([4, 3, 2, 1]);
    });
  });

  describe('sort', () => {
    it('should be unsupported (removed for lightweight)', () => {
      const jpc = makeArrJPC([3, 1, 2]);
      expect(() => jpc.updateArray('arr', 'sort', [])).toThrow();
    });
  });

  describe('complex nested arrays', () => {
    it('should handle nested array operations correctly', () => {
      const jpc = new JSONPC('{"nested": {"arr": [1, 2]}}');
      setComments(jpc, 'nested.arr.0', ['comment for nested.arr.0']);
      setComments(jpc, 'nested.arr.1', ['comment for nested.arr.1']);

      jpc.updateArray('nested.arr', 'push', [3]);

      expect(getComments(jpc, 'nested.arr.0')).toEqual(['comment for nested.arr.0']);
      expect(getComments(jpc, 'nested.arr.1')).toEqual(['comment for nested.arr.1']);
      expect(jpc.get('nested.arr')?.value).toEqual([1, 2, 3]);
    });

    it('should handle shift on nested array', () => {
      const jpc = new JSONPC('{"data": {"items": ["a", "b", "c"]}}');
      setComments(jpc, 'data.items.0', ['first item']);
      setComments(jpc, 'data.items.1', ['second item']);
      setComments(jpc, 'data.items.2', ['third item']);

      jpc.updateArray('data.items', 'shift', []);

      expect(getComments(jpc, 'data.items.0')).toEqual(['second item']);
      expect(getComments(jpc, 'data.items.1')).toEqual(['third item']);
      expect(getComments(jpc, 'data.items.2')).toBeUndefined();
      expect(jpc.get('data.items')?.value).toEqual(['b', 'c']);
    });
  });

  describe('value consistency after operations', () => {
    it('should get correct values after push', () => {
      const jpc = makeArrJPC([10, 20]);
      jpc.updateArray('arr', 'push', [30]);
      expect(jpc.get('arr.0')?.value).toBe(10);
      expect(jpc.get('arr.1')?.value).toBe(20);
      expect(jpc.get('arr.2')?.value).toBe(30);
    });

    it('should get correct values after pop', () => {
      const jpc = makeArrJPC([10, 20, 30]);
      jpc.updateArray('arr', 'pop', []);
      expect(jpc.get('arr.0')?.value).toBe(10);
      expect(jpc.get('arr.1')?.value).toBe(20);
      expect(jpc.get('arr.2')).toBeUndefined();
    });

    it('should get correct values after shift', () => {
      const jpc = makeArrJPC([10, 20, 30]);
      jpc.updateArray('arr', 'shift', []);
      expect(jpc.get('arr.0')?.value).toBe(20);
      expect(jpc.get('arr.1')?.value).toBe(30);
    });

    it('should get correct values after unshift', () => {
      const jpc = makeArrJPC([20, 30]);
      jpc.updateArray('arr', 'unshift', [10]);
      expect(jpc.get('arr.0')?.value).toBe(10);
      expect(jpc.get('arr.1')?.value).toBe(20);
      expect(jpc.get('arr.2')?.value).toBe(30);
    });
  });
});
