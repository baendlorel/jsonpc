import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';
import { Value } from '../src/core/value.js';

/**
 * Helper function to create a JSONPC instance with an array
 */
function makeArrJPC(arr: any[]) {
  return new JSONPC(JSON.stringify({ arr }));
}

/**
 * Helper function to set comments for a property path
 */
function setComments(jpc: JSONPC, path: string, comments: string[]): void {
  const current = jpc.get(path);
  jpc.set(path, { value: current?.value, comments });
}

/**
 * Helper function to get comments for a property path
 */
function getComments(jpc: JSONPC, path: string): string[] | undefined {
  return jpc.get(path)?.comments;
}

/**
 * Helper function to get value for a property path
 */
function getValue(jpc: JSONPC, path: string): any {
  return jpc.get(path)?.value;
}

describe('Array operations with Value-based comments', () => {
  describe('basic array element operations', () => {
    it('should preserve comments when setting array elements individually', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      setComments(jpc, 'arr.0', ['first element']);
      setComments(jpc, 'arr.1', ['second element']);
      setComments(jpc, 'arr.2', ['third element']);

      // Modify an array element
      jpc.set('arr.1', { value: 99 });

      expect(getValue(jpc, 'arr.0')).toBe(1);
      expect(getComments(jpc, 'arr.0')).toEqual(['first element']);

      expect(getValue(jpc, 'arr.1')).toBe(99);
      expect(getComments(jpc, 'arr.1')).toEqual(['second element']);

      expect(getValue(jpc, 'arr.2')).toBe(3);
      expect(getComments(jpc, 'arr.2')).toEqual(['third element']);
    });

    it('should handle replacing entire array with new values', () => {
      const jpc = makeArrJPC([1, 2, 3]);
      setComments(jpc, 'arr.0', ['old first']);
      setComments(jpc, 'arr.1', ['old second']);

      // Replace entire array
      jpc.set('arr', { value: [10, 20, 30] });

      expect(getValue(jpc, 'arr')).toEqual([10, 20, 30]);
      // Comments should be cleared for the array itself
      expect(getComments(jpc, 'arr')).toEqual([]);
      // Individual element comments should be lost since we replaced the array
      expect(getComments(jpc, 'arr.0')).toEqual([]);
    });

    it('should preserve comments when modifying nested object inside array', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          arr: [{ name: 'a' }, { name: 'b' }],
        }),
      );

      setComments(jpc, 'arr.0', ['first item']);
      setComments(jpc, 'arr.0.name', ['name of first']);
      setComments(jpc, 'arr.1', ['second item']);

      // Modify nested property
      jpc.set('arr.0.name', { value: 'updated' });

      expect(getValue(jpc, 'arr.0.name')).toBe('updated');
      expect(getComments(jpc, 'arr.0')).toEqual(['first item']);
      expect(getComments(jpc, 'arr.0.name')).toEqual(['name of first']);
      expect(getComments(jpc, 'arr.1')).toEqual(['second item']);
    });
  });

  describe('array with Value objects as elements', () => {
    it('should handle arrays with Value objects', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [] }));

      // Set elements with comments
      jpc.set('arr', {
        value: [new Value(['comment for 0'], 1), new Value(['comment for 1'], 2), new Value(['comment for 2'], 3)],
      });

      expect(getValue(jpc, 'arr.0')).toBe(1);
      expect(getComments(jpc, 'arr.0')).toEqual(['comment for 0']);
      expect(getValue(jpc, 'arr.1')).toBe(2);
      expect(getComments(jpc, 'arr.1')).toEqual(['comment for 1']);
      expect(getValue(jpc, 'arr.2')).toBe(3);
      expect(getComments(jpc, 'arr.2')).toEqual(['comment for 2']);
    });

    it('should handle mixed Value and primitive elements', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [] }));

      jpc.set('arr', {
        value: [
          new Value(['commented'], 1),
          2, // primitive without comment
          new Value(['also commented'], 3),
        ],
      });

      expect(getComments(jpc, 'arr.0')).toEqual(['commented']);
      expect(getComments(jpc, 'arr.1')).toEqual([]);
      expect(getComments(jpc, 'arr.2')).toEqual(['also commented']);
    });
  });

  describe('stringification limitations with array elements', () => {
    it('should note that array element comments are not serialized', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [] }));

      jpc.set('arr', { value: [new Value(['first element'], 1), new Value(['second element'], 2)] });

      const output = jpc.stringify();

      // Note: Current implementation does not serialize comments for array elements
      // Comments are only serialized for object properties
      expect(output).toContain('"arr":');
      expect(output).toContain('1');
      expect(output).toContain('2');

      // Array element comments are preserved in memory but not serialized
      expect(getComments(jpc, 'arr.0')).toEqual(['first element']);
      expect(getComments(jpc, 'arr.1')).toEqual(['second element']);
    });

    it('should handle object properties with comments inside arrays', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          nested: {
            arr: [{ x: 1 }, { x: 2 }],
          },
        }),
      );

      // Set comments on object properties inside array
      setComments(jpc, 'nested.arr.0.x', ['nested 1']);
      setComments(jpc, 'nested.arr.1.x', ['nested 2']);

      const output = jpc.stringify();

      // Object property comments should be serialized
      expect(output).toContain('// nested 1');
      expect(output).toContain('// nested 2');
    });
  });

  describe('complex array structures', () => {
    it('should handle array of objects with comments', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        }),
      );

      setComments(jpc, 'users.0', ['admin user']);
      setComments(jpc, 'users.0.name', ['Alice is admin']);
      setComments(jpc, 'users.1', ['regular user']);
      setComments(jpc, 'users.1.name', ['Bob is regular']);

      expect(getComments(jpc, 'users.0')).toEqual(['admin user']);
      expect(getComments(jpc, 'users.0.name')).toEqual(['Alice is admin']);
      expect(getComments(jpc, 'users.1')).toEqual(['regular user']);
      expect(getComments(jpc, 'users.1.name')).toEqual(['Bob is regular']);

      // Modify user data
      jpc.set('users.0.name', { value: 'Admin Alice' });

      expect(getValue(jpc, 'users.0.name')).toBe('Admin Alice');
      expect(getComments(jpc, 'users.0.name')).toEqual(['Alice is admin']);
    });

    it('should handle deeply nested array access', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          data: {
            items: [{ values: [10, 20] }, { values: [30, 40] }],
          },
        }),
      );

      setComments(jpc, 'data.items.0', ['first item group']);
      setComments(jpc, 'data.items.0.values.0', ['ten']);
      setComments(jpc, 'data.items.0.values.1', ['twenty']);
      setComments(jpc, 'data.items.1', ['second item group']);

      expect(getComments(jpc, 'data.items.0')).toEqual(['first item group']);
      expect(getComments(jpc, 'data.items.0.values.0')).toEqual(['ten']);
      expect(getComments(jpc, 'data.items.0.values.1')).toEqual(['twenty']);
      expect(getComments(jpc, 'data.items.1')).toEqual(['second item group']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [] }));
      setComments(jpc, 'arr', ['empty array comment']);

      expect(getValue(jpc, 'arr')).toEqual([]);
      expect(getComments(jpc, 'arr')).toEqual(['empty array comment']);
    });

    it('should handle single element arrays', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [42] }));
      setComments(jpc, 'arr.0', ['only element']);

      expect(getValue(jpc, 'arr.0')).toBe(42);
      expect(getComments(jpc, 'arr.0')).toEqual(['only element']);
    });

    it('should handle array with null/undefined values', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          arr: [1, null, 3],
        }),
      );

      setComments(jpc, 'arr.0', ['one']);
      setComments(jpc, 'arr.1', ['null value']);
      setComments(jpc, 'arr.2', ['three']);

      expect(getValue(jpc, 'arr.1')).toBeNull();
      expect(getComments(jpc, 'arr.1')).toEqual(['null value']);
    });

    it('should handle array with mixed types', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          mixed: [1, 'string', true, { obj: true }, [1, 2]],
        }),
      );

      setComments(jpc, 'mixed.0', ['number']);
      setComments(jpc, 'mixed.1', ['text']);
      setComments(jpc, 'mixed.2', ['boolean']);
      setComments(jpc, 'mixed.3', ['object']);
      setComments(jpc, 'mixed.4', ['nested array']);

      expect(getComments(jpc, 'mixed.0')).toEqual(['number']);
      expect(getComments(jpc, 'mixed.1')).toEqual(['text']);
      expect(getComments(jpc, 'mixed.2')).toEqual(['boolean']);
      expect(getComments(jpc, 'mixed.3')).toEqual(['object']);
      expect(getComments(jpc, 'mixed.4')).toEqual(['nested array']);
    });
  });

  describe('toObject with commented array elements', () => {
    it('should strip comments from array elements', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [] }));

      jpc.set('arr', {
        value: [new Value(['comment 1'], 1), new Value(['comment 2'], 2), new Value(['comment 3'], 3)],
      });

      const obj = jpc.toObject();

      expect(obj.arr).toEqual([1, 2, 3]);
      expect(obj.arr[0]).not.toHaveProperty('comments');
    });

    it('should handle nested structures with comments', () => {
      const jpc = new JSONPC(
        JSON.stringify({
          data: {
            items: [{ name: 'test' }],
          },
        }),
      );

      setComments(jpc, 'data.items.0', ['item']);
      setComments(jpc, 'data.items.0.name', ['name']);

      const obj = jpc.toObject();

      expect(obj.data.items[0]).toEqual({ name: 'test' });
      expect(obj.data.items[0]).not.toHaveProperty('comments');
    });
  });

  describe('value consistency across operations', () => {
    it('should maintain value integrity after multiple operations', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [1, 2, 3, 4] }));

      // Set initial comments
      setComments(jpc, 'arr.0', ['first']);
      setComments(jpc, 'arr.1', ['second']);
      setComments(jpc, 'arr.2', ['third']);
      setComments(jpc, 'arr.3', ['fourth']);

      // Perform various operations
      jpc.set('arr.0', { value: 10 });
      jpc.set('arr.2', { value: 30 });
      // Update comments for arr.1
      const current = jpc.get('arr.1');
      jpc.set('arr.1', { value: current?.value, comments: ['updated second'] });

      // Verify all values and comments
      expect(getValue(jpc, 'arr.0')).toBe(10);
      expect(getComments(jpc, 'arr.0')).toEqual(['first']);

      expect(getValue(jpc, 'arr.1')).toBe(2);
      expect(getComments(jpc, 'arr.1')).toEqual(['updated second']);

      expect(getValue(jpc, 'arr.2')).toBe(30);
      expect(getComments(jpc, 'arr.2')).toEqual(['third']);

      expect(getValue(jpc, 'arr.3')).toBe(4);
      expect(getComments(jpc, 'arr.3')).toEqual(['fourth']);
    });

    it('should handle comments on array itself vs elements', () => {
      const jpc = new JSONPC(JSON.stringify({ arr: [1, 2, 3] }));

      // Set comment on array itself
      setComments(jpc, 'arr', ['this is an array']);

      // Set comments on elements
      setComments(jpc, 'arr.0', ['first']);
      setComments(jpc, 'arr.1', ['second']);

      expect(getComments(jpc, 'arr')).toEqual(['this is an array']);
      expect(getComments(jpc, 'arr.0')).toEqual(['first']);
      expect(getComments(jpc, 'arr.1')).toEqual(['second']);

      const output = jpc.stringify();
      // Array comment should be serialized
      expect(output).toContain('// this is an array');
      // Note: Array element comments are not serialized in current implementation
      // but they are preserved in memory
    });
  });

  describe('real-world scenarios', () => {
    it('should handle configuration array with comments', () => {
      const config = {
        servers: [
          { host: 'localhost', port: 3000 },
          { host: 'backup', port: 3000 },
        ],
      };

      const jpc = new JSONPC(JSON.stringify(config));

      setComments(jpc, 'servers', ['List of servers']);
      setComments(jpc, 'servers.0', ['Primary server']);
      setComments(jpc, 'servers.0.host', ['Main host']);
      setComments(jpc, 'servers.1', ['Backup server']);
      setComments(jpc, 'servers.1.host', ['Backup host']);

      // Update backup server port
      jpc.set('servers.1.port', { value: 4000 });

      expect(getValue(jpc, 'servers.1.port')).toBe(4000);
      expect(getComments(jpc, 'servers.1.port')).toEqual([]);
      expect(getComments(jpc, 'servers.1')).toEqual(['Backup server']);
    });

    it('should handle todo list with comments', () => {
      const todoList = {
        tasks: [
          { id: 1, title: 'Write tests', done: false },
          { id: 2, title: 'Fix bugs', done: true },
          { id: 3, title: 'Deploy', done: false },
        ],
      };

      const jpc = new JSONPC(JSON.stringify(todoList));

      setComments(jpc, 'tasks', ['Task list']);
      setComments(jpc, 'tasks.0', ['High priority']);
      setComments(jpc, 'tasks.1', ['Completed']);
      setComments(jpc, 'tasks.2', ['Pending']);

      // Mark first task as done
      jpc.set('tasks.0.done', { value: true });

      expect(getValue(jpc, 'tasks.0.done')).toBe(true);
      expect(getComments(jpc, 'tasks.0')).toEqual(['High priority']);
    });
  });
});
