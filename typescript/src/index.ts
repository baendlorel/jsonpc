import { get as _get, set as _set, has as _has, deleteProperty as _delete } from 'reflect-deep';
import {
  isComment,
  trim,
  stripTopBottom,
  aggregate,
  stripPrefix,
  mark,
  visit,
  clone,
  serialize,
  split,
} from './core.js';
import { _isArray, _mustArray } from './common.js';
import { arrayOpers, getArray, SupportedArrayMethods } from './array.js';

if (typeof COMMENT_PREFIX === 'undefined') {
  (globalThis as any).COMMENT_PREFIX = '//';
}

interface Entry {
  value: any;
  comments?: string[];
}

export class JSONPC {
  private top: string[] = [];
  private bottom: string[] = [];

  /**
   * Map a property path to a comment string array.
   */
  private commentMap: any;
  private data: any;

  /**
   * This is actually the parser
   * @param text json text
   * @param reviver A function that transforms the results. This function is called for each member of the object.
   */
  constructor(text: string, reviver?: (this: any, key: string, value: any) => any) {
    const lines = trim(text);
    const withoutComments = lines.filter((v) => !isComment(v));
    const rawJson = withoutComments.join('');
    try {
      this.data = reviver ? JSON.parse(rawJson, reviver) : JSON.parse(rawJson);
    } catch (e) {
      throw new Error(`Json text being parsed is invalid, ${(e as Error).message}`);
    }

    // & Now the json is some how valid.

    // Fill the whole file level comments
    const stripIndex = stripTopBottom(lines);
    if (!Number.isNaN(stripIndex.bottom)) {
      this.bottom = lines.splice(stripIndex.bottom).map(stripPrefix); //! Must be done first, or indexes will change.
    }
    if (!Number.isNaN(stripIndex.top)) {
      this.top = lines.splice(0, stripIndex.top + 1).map(stripPrefix);
    }

    const aggregated = aggregate(lines);
    const named = mark(aggregated);
    this.data = JSON.parse(named.lines.join(''));
    // visit stores comment arrays in commentMap keyed by property path, and deletes uuid keys from data
    this.commentMap = visit(this.data, named.unames);
  }

  get topComments(): string[] {
    return this.top;
  }

  get bottomComments(): string[] {
    return this.bottom;
  }

  set topComments(comments: string[]) {
    _mustArray(comments, 'comments');
    this.top = [...comments];
  }

  set bottomComments(comments: string[]) {
    _mustArray(comments, 'comments');
    this.bottom = [...comments];
  }

  /**
   * Set entry for a property path.
   * - set `entry.comments` to `[]` to remove them.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param entry Optional `value` and `comments` properties. Will set the provided ones.
   *
   */
  set(propPath: string | string[], entry: Partial<Entry>): this {
    const k = split(propPath);
    if ('value' in entry) {
      _set(this.data, k, entry.value);
    }
    if ('comments' in entry) {
      _mustArray(entry.comments, 'comments');
      if (entry.comments.length === 0) {
        _delete(this.commentMap, k);
      } else {
        _set(this.commentMap, k, entry.comments);
      }
    }
    return this;
  }

  /**
   * Get entry for a property path.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   */
  get(propPath: string | string[]): Entry | undefined {
    const k = split(propPath);
    if (!_has(this.data, k)) {
      return undefined;
    }
    return { value: _get(this.data, k), comments: _get(this.commentMap, k) };
  }

  /**
   * Update an array property by calling a supported array method.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param method Supported array method like `"push"`, `"pop"`, etc.
   * @param args Arguments to pass to the array method
   * @returns The instance itself for chaining
   */
  updateArray<Fn extends SupportedArrayMethods>(
    propPath: string | string[],
    method: Fn,
    args: Parameters<Array<any>[Fn]>,
  ): this {
    const { k, arr } = getArray(propPath, this.data);
    arrayOpers[method](arr, args as any, this.commentMap, k);
    return this;
  }

  /**
   * Convert the data back to json text, with comments.
   * - Like `JSON.stringify(data, null, 2)`.
   * - Definitely change lines.
   *
   * @param replacer Like the replacer in `JSON.stringify`, default is `undefined`.
   * @param space default is 2.
   */
  stringify(
    replacer?: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
    space?: number,
  ): string {
    const top = this.top.map((v) => `${COMMENT_PREFIX} ${v}`);
    const lines = serialize(this.commentMap, this.data, space ?? 2, replacer ?? null);
    const bottom = this.bottom.map((v) => `${COMMENT_PREFIX} ${v}`);

    return top.concat(lines, bottom).join('\n');
  }

  /**
   * Return a pure js object, stripping all comment artifacts.
   * - The internal data is already clean (uuid keys removed by visit),
   *   so this is a simple deep clone.
   */
  toObject<T = any>(): T {
    return clone(this.data) as T;
  }

  /**
   * Transform to standard JSON string without comments.
   * Equal to `JSON.stringify(this.toJSON(), null, 2)`.
   */
  stringifyWithoutComment(
    replacer?: ((this: any, key: string, value: any) => any) | null,
    space?: string | number,
  ): string;
  stringifyWithoutComment(...args: any[]) {
    return JSON.stringify(this.toObject(), ...args);
  }

  /**
   * Release the references, clear internal containers.
   */
  destroy() {
    this.top.length = 0;
    this.bottom.length = 0;
    this.commentMap.clear();

    this.top = null as any;
    this.bottom = null as any;
    this.data = null as any;
    this.commentMap = null as any;
  }
}

/**
 * Parse jsonpc text into an operatable instance.
 * - You can set values/comments of any property path.
 * - You can use `result.toObject()` to get a pure js object without comments for convenience.
 * @param text raw json text with property comments.
 * @param reviver Same as the reviver in `JSON.parse`.
 * @returns an operatable instance.
 */
export function parse(text: string, reviver?: (this: any, key: string, value: any) => any): JSONPC {
  return new JSONPC(text, reviver);
}

export function stringify(
  jsonpc: JSONPC,
  replacer?: ((this: any, key: string, value: any) => any) | null,
  space?: string | number,
): string;
export function stringify(jsonpc: JSONPC, ...args: any[]): string {
  return jsonpc.stringify(...args);
}
