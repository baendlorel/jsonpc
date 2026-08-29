import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';

describe('Array operations with commentsMap synchronization', () => {

  describe('push', () => {
    it('should not affect existing comments when pushing elements', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2
  ]
}`;
      const jpc = new JSONPC(text);

      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);

      jpc.updateArray('arr', 'push', [3]);

      // Existing comments should remain unchanged
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });
  });

  describe('pop', () => {
    it('should remove comments for the popped element', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3
  ]
}`;
      const jpc = new JSONPC(text);

      expect(jpc.getComments('arr.2')).toEqual(['comment for 2']);

      jpc.updateArray('arr', 'pop', []);

      // Comment for index 2 should be removed
      expect(jpc.getComments('arr.2')).toBeUndefined();
      // Other comments should remain
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);
      expect(jpc.get('arr')).toEqual([1, 2]);
    });
  });

  describe('shift', () => {
    it('should shift all comments and remove first element comments', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3
  ]
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('arr', 'shift', []);

      // Index 0 comment should be removed
      expect(jpc.getComments('arr.0')).toBeUndefined();
      // Index 1 comment should become index 0
      expect(jpc.getComments('arr.0')).toEqual(['comment for 1']);
      // Index 2 comment should become index 1
      expect(jpc.getComments('arr.1')).toEqual(['comment for 2']);
      expect(jpc.get('arr')).toEqual([2, 3]);
    });
  });

  describe('unshift', () => {
    it('should shift all comments to make room for new element', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2
  ]
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('arr', 'unshift', [0]);

      // Index 0 comment should become index 1
      expect(jpc.getComments('arr.1')).toEqual(['comment for 0']);
      // Index 1 comment should become index 2
      expect(jpc.getComments('arr.2')).toEqual(['comment for 1']);
      // New index 0 should have no comments
      expect(jpc.getComments('arr.0')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([0, 1, 2]);
    });
  });

  describe('splice', () => {
    it('should handle splice delete without insert', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3,
    // comment for 3
    4
  ]
}`;
      const jpc = new JSONPC(text);

      // Delete 2 elements starting from index 1
      jpc.updateArray('arr', 'splice', [1, 2]);

      // Comments for deleted indices should be removed
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      // Comments for indices after deleted range should shift
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 3']);
      expect(jpc.get('arr')).toEqual([1, 4]);
    });

    it('should handle splice insert without delete', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3
  ]
}`;
      const jpc = new JSONPC(text);

      // Insert 2 elements at index 1
      jpc.updateArray('arr', 'splice', [1, 0, 'a', 'b']);

      // Existing comments should shift to make room
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.4')).toEqual(['comment for 2']);
      // New elements should have no comments
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([1, 'a', 'b', 2, 3]);
    });

    it('should handle splice with both delete and insert', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3,
    // comment for 3
    4
  ]
}`;
      const jpc = new JSONPC(text);

      // Delete 1 element at index 1, insert 2 elements
      jpc.updateArray('arr', 'splice', [1, 1, 'a', 'b']);

      // Comment for deleted index 1 should be removed
      expect(jpc.getComments('arr.1')).toBeUndefined();
      // Comments after the affected range should shift
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.4')).toEqual(['comment for 3']);
      // New elements should have no comments
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([1, 'a', 'b', 3, 4]);
    });
  });

  describe('reverse', () => {
    it('should reverse the comment mapping for array elements', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3
  ]
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('arr', 'reverse', []);

      // Comments should be reversed
      expect(jpc.getComments('arr.0')).toEqual(['comment for 2']);
      expect(jpc.getComments('arr.1')).toEqual(['comment for 1']);
      expect(jpc.getComments('arr.2')).toEqual(['comment for 0']);
      expect(jpc.get('arr')).toEqual([3, 2, 1]);
    });
  });

  describe('fill', () => {
    it('should clear comments for filled range', () => {
      const text = `{
  "arr": [
    // comment for 0
    1,
    // comment for 1
    2,
    // comment for 2
    3,
    // comment for 3
    4
  ]
}`;
      const jpc = new JSONPC(text);

      // Fill indices 1-2 with 0
      jpc.updateArray('arr', 'fill', [0, 1, 3]);

      // Comments for filled range should be cleared
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      // Comments outside range should remain
      expect(jpc.getComments('arr.0')).toEqual(['comment for 0']);
      expect(jpc.getComments('arr.3')).toEqual(['comment for 3']);
      expect(jpc.get('arr')).toEqual([1, 0, 0, 4]);
    });
  });

  describe('sort', () => {
    it('should clear comments for array elements after sort', () => {
      const text = `{
  "arr": [
    // comment for 0
    3,
    // comment for 1
    1,
    // comment for 2
    2
  ]
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('arr', 'sort', []);

      // All array element comments should be cleared
      expect(jpc.getComments('arr.0')).toBeUndefined();
      expect(jpc.getComments('arr.1')).toBeUndefined();
      expect(jpc.getComments('arr.2')).toBeUndefined();
      expect(jpc.get('arr')).toEqual([1, 2, 3]);
    });
  });

  describe('complex nested arrays', () => {
    it('should handle nested array operations correctly', () => {
      const text = `{
  "nested": {
    "arr": [
      // comment for nested.arr.0
      1,
      // comment for nested.arr.1
      2
    ]
  }
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('nested.arr', 'push', [3]);

      // Comments for nested array should work correctly
      expect(jpc.getComments('nested.arr.0')).toEqual(['comment for nested.arr.0']);
      expect(jpc.getComments('nested.arr.1')).toEqual(['comment for nested.arr.1']);
      expect(jpc.get('nested.arr')).toEqual([1, 2, 3]);
    });

    it('should handle shift on nested array', () => {
      const text = `{
  "data": {
    "items": [
      // first item
      "a",
      // second item
      "b",
      // third item
      "c"
    ]
  }
}`;
      const jpc = new JSONPC(text);

      jpc.updateArray('data.items', 'shift', []);

      // After shift, second item becomes first, third becomes second
      expect(jpc.getComments('data.items.0')).toEqual(['second item']);
      expect(jpc.getComments('data.items.1')).toEqual(['third item']);
      // First item comment should be gone
      expect(jpc.getComments('data.items.2')).toBeUndefined();
      expect(jpc.get('data.items')).toEqual(['b', 'c']);
    });
  });

  describe('round-trip with array operations', () => {
    it('should preserve comments through parse -> modify -> stringify -> parse', () => {
      const text = `{
  "arr": [
    // first
    1,
    // second
    2
  ]
}`;
      const jpc1 = new JSONPC(text);

      // Perform array operations
      jpc1.updateArray('arr', 'push', [3]);
      jpc1.setComments('arr.2', ['third']);

      const output = jpc1.stringify();
      const jpc2 = new JSONPC(output);

      // Comments should be preserved
      expect(jpc2.getComments('arr.0')).toEqual(['first']);
      expect(jpc2.getComments('arr.1')).toEqual(['second']);
      expect(jpc2.getComments('arr.2')).toEqual(['third']);
      expect(jpc2.get('arr')).toEqual([1, 2, 3]);
    });
  });
});
