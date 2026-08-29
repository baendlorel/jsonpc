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

describe('Array operations with commentsMap synchronization', () => {
  describe('push', () => {
    it('should not affect existing comments when pushing elements', () => {
      const jpc = makeArrJPC([1, 2]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);

      jpc.updateArray('arr', 'push', [3]);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });
  });

  describe('pop', () => {
    it('should remove comments for the popped element', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'pop', []);

      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')).toEqual([1, 2]);
    });

    it('should work with nested path', () => {
      const jpc = new JSONPC('{"data": {"items": [1, 2, 3]}}');
      jpc.setComments('data.items.0', ['first']);
      jpc.setComments('data.items.1', ['second']);
      jpc.setComments('data.items.2', ['third']);

      jpc.updateArray('data.items', 'pop', []);

      expect(jpc.getComments('data.items.2')).toBeUndefined();
      expect(jpc.getComments('data.items.0')).toEqual(['first']);
      expect(jpc.getComments('data.items.1')).toEqual(['second']);
      expect(jpc.get('data.items')).toEqual([1, 2]);
    });
  });

  describe('shift', () => {
    it('should shift all comments and remove first element comments', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'shift', []);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([2, 3]);
    });
  });

  describe('unshift', () => {
    it('should shift all comments to make room for new element', () => {
      const jpc = makeArrJPC([1, 2]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);

      jpc.updateArray('arr', 'unshift', [0]);

      expect(jpc.getComments('arr.1')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.2')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.0')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([0, 1, 2]);
    });
  });

  describe('splice', () => {
    it('should handle splice delete without insert', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);
      jpc.setComments('arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'splice', [1, 2]);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 3']);
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([1, 4]);
    });

    it('should handle splice insert without delete', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'splice', [1, 0, 'a', 'b']);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.4')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([1, 'a', 'b', 2, 3]);
    });

    it('should handle splice with both delete and insert', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);
      jpc.setComments('arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'splice', [1, 1, 'a', 'b']);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 2']); // Original index 2 moves to index 3
      expect(jpc.getComments('arr.4')).toEqual(['comment for 3']); // Original index 3 moves to index 4
      expect(jpc.getComments('arr.1')).toBeUndefined(); // Newly inserted 'a'
      expect(jpc.getComments('arr.2')).toBeUndefined(); // Newly inserted 'b'
      expect(jpc.get('arr')).toEqual([1, 'a', 'b', 3, 4]);
    });
  });

  describe('reverse', () => {
    it('should reverse the comment mapping for array elements', () => {
      const jpc = makeArrJPC([1, 2, 3, 4]);
      jpc.setComments('arr.0', ['comment for 0']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);
      jpc.setComments('arr.3', ['comment for 3']);

      jpc.updateArray('arr', 'reverse', []);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 3']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.2')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 0']);
      expect(jpc.get('arr')).toEqual([4, 3, 2, 1]);
    });
  });

  describe('sort', () => {
    it('should keep comments synced with elements after sort', () => {
      const jpc = makeArrJPC([3, 1, 2]);
      jpc.setComments('arr.0', ['comment for 3']);
      jpc.setComments('arr.1', ['comment for 1']);
      jpc.setComments('arr.2', ['comment for 2']);

      jpc.updateArray('arr', 'sort', []);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.2')).toEqual(['comment for 3']);
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });

    it('should handle sort with custom compare function', () => {
      const jpc = makeArrJPC(['c', 'a', 'b']);
      jpc.setComments('arr.0', ['c comment']);
      jpc.setComments('arr.1', ['a comment']);
      jpc.setComments('arr.2', ['b comment']);

      jpc.updateArray('arr', 'sort', [(a: string, b: string) => b.localeCompare(a)]);

      expect(jpc.getComments('arr.0')).toEqual(['c comment']);
      expect(jpc.getComments('arr.1')).toEqual(['b comment']);
      expect(jpc.getComments('arr.2')).toEqual(['a comment']);
      expect(jpc.get('arr')).toEqual(['c', 'b', 'a']);
    });

    it('should handle already sorted array', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      jpc.setComments('arr.0', ['first']);
      jpc.setComments('arr.1', ['second']);
      jpc.setComments('arr.2', ['third']);

      jpc.updateArray('arr', 'sort', []);

      expect(jpc.getComments('arr.0')).toEqual(['first']);
      expect(jpc.getComments('arr.1')).toEqual(['second']);
      expect(jpc.getComments('arr.2')).toEqual(['third']);
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });

    it('should handle single-element array', () => {
      const jpc = makeArrJPC([42]);
      jpc.setComments('arr.0', ['only']);

      jpc.updateArray('arr', 'sort', []);

      expect(jpc.getComments('arr.0')).toEqual(['only']);
      expect(jpc.get('arr')).toEqual([42]);
    });

    it('should handle empty array', () => {
      const jpc = makeArrJPC([]);
      jpc.updateArray('arr', 'sort', []);
      expect(jpc.get('arr')).toEqual([]);
    });
  });

  describe('complex nested arrays', () => {
    it('should handle nested array operations correctly', () => {
      const jpc = new JSONPC('{"nested": {"arr": [1, 2]}}');
      jpc.setComments('nested.arr.0', ['comment for nested.arr.0']);
      jpc.setComments('nested.arr.1', ['comment for nested.arr.1']);

      jpc.updateArray('nested.arr', 'push', [3]);

      expect(jpc.getComments('nested.arr.0')).toEqual(['comment for nested.arr.0']);
      expect(jpc.getComments('nested.arr.1')).toEqual(['comment for nested.arr.1']);
      expect(jpc.get('nested.arr')).toEqual([1, 2, 3]);
    });

    it('should handle shift on nested array', () => {
      const jpc = new JSONPC('{"data": {"items": ["a", "b", "c"]}}');
      jpc.setComments('data.items.0', ['first item']);
      jpc.setComments('data.items.1', ['second item']);
      jpc.setComments('data.items.2', ['third item']);

      jpc.updateArray('data.items', 'shift', []);
      console.log(jpc.commentMap.map.get('data').get('items'));

      expect(jpc.getComments('data.items.0')).toEqual(['second item']);
      expect(jpc.getComments('data.items.1')).toEqual(['third item']);
      expect(jpc.getComments('data.items.2')).toBeUndefined();
      expect(jpc.get('data.items')).toEqual(['b', 'c']);
    });
  });

  describe('value consistency after operations', () => {
    it('should get correct values after push', () => {
      const jpc = makeArrJPC([10, 20]);
      jpc.updateArray('arr', 'push', [30]);
      expect(jpc.get('arr.0')).toBe(10);
      expect(jpc.get('arr.1')).toBe(20);
      expect(jpc.get('arr.2')).toBe(30);
    });

    it('should get correct values after pop', () => {
      const jpc = makeArrJPC([10, 20, 30]);
      jpc.updateArray('arr', 'pop', []);
      expect(jpc.get('arr.0')).toBe(10);
      expect(jpc.get('arr.1')).toBe(20);
      expect(jpc.get('arr.2')).toBeUndefined();
    });

    it('should get correct values after shift', () => {
      const jpc = makeArrJPC([10, 20, 30]);
      jpc.updateArray('arr', 'shift', []);
      expect(jpc.get('arr.0')).toBe(20);
      expect(jpc.get('arr.1')).toBe(30);
    });

    it('should get correct values after unshift', () => {
      const jpc = makeArrJPC([20, 30]);
      jpc.updateArray('arr', 'unshift', [10]);
      expect(jpc.get('arr.0')).toBe(10);
      expect(jpc.get('arr.1')).toBe(20);
      expect(jpc.get('arr.2')).toBe(30);
    });
  });
});
