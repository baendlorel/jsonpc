import { ReflectDeep } from 'reflect-deep';
import { isComment, trim, stripTopBottom, aggregate, stripPrefix, mark, visit, clone, serialize } from './core.js';
import { PathMap } from './path-map.js';
import { _isArray } from './common.js';
import { getArray, SupportedArrayMethods } from './array.js';

if (typeof COMMENT_PREFIX === 'undefined') {
  (globalThis as any).COMMENT_PREFIX = '//';
}

export class JSONPC {
  private top: string[] = [];
  private bottom: string[] = [];

  /** Maps property path (string[]) → comment content lines (string[], without `//` prefix) */
  private commentMap: PathMap = new PathMap();

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

  /**
   * Set comment for a property path.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param comments comment content lines (without `//` prefix)
   */
  setComments(propPath: string, comments: string[]): this {
    if (!_isArray(comments)) {
      throw new TypeError(`Invalid comments argument, must be an array of strings or a function.`);
    }
    this.commentMap.set(propPath.split('.'), comments);
    return this;
  }

  /**
   * Get comment for a property path.
   * Return `undefined` if the property path does not exist.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @returns comment content lines (without `//` prefix), or `undefined`
   */
  getComments(propPath: string): string[] | undefined {
    return this.commentMap.get(propPath.split('.'));
  }

  /**
   * Set value for a property path, creating the path if it does not exist.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param value
   */
  set(propPath: string, value: any): this {
    ReflectDeep.set(this.data, propPath.split('.'), value);
    return this;
  }

  /**
   * Get value for a property path, return `defaultValue` if the property path does not exist.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param defaultValue the value to return if the property path does not exist
   */
  get(propPath: string, defaultValue?: any) {
    const result = ReflectDeep.get(this.data, propPath.split('.'));
    return result === undefined ? defaultValue : result;
  }

  /**
   * Update an array property by calling a supported array method.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param method Supported array method like `"push"`, `"pop"`, etc.
   * @param args Arguments to pass to the array method
   * @returns The instance itself for chaining
   */
  updateArray<Fn extends SupportedArrayMethods>(propPath: string, method: Fn, args: Parameters<Array<any>[Fn]>): this {
    const { k, arr } = getArray(propPath, this.data);
    arrayOpers[method](arr, args, this.commentMap, k);
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
