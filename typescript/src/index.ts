import { aggregate, mark, visit } from './core/initializers.js';
import { _isArray, _notComment, _split, _stripPrefix } from './core/common.js';
import { _set, _delete, _get, CommentMap } from './core/path-map.js';

import { arrayOpers, SupportedArrayMethods } from './core/array.js';
import { stripTrailingCommas } from './walkers/trailing-comma.js';
import { serialize } from './core/serializer.js';

if (typeof COMMENT_PREFIX === 'undefined') {
  (globalThis as any).COMMENT_PREFIX = '//';
}
if (typeof SEP === 'undefined') {
  (globalThis as any).SEP = '\uE000';
}

interface Entry {
  value: any;
  comments?: string[];
}

export class JSONPC {
  /**
   * Comments at the top of the file.Carefully modify it.
   */
  public top: string[] = [];
  /**
   * Comments at the bottom of the file.Carefully modify it.
   */
  public bottom: string[] = [];

  /**
   * Map a property path to a comment string array.
   */
  private comments: CommentMap = new Map<string, string[]>();
  private data: any;

  /**
   * This is actually the parser
   * @param text json text
   * @param reviver A function that transforms the results. This function is called for each member of the object.
   */
  constructor(text: string, reviver?: (this: any, key: string, value: any) => any) {
    const lines0 = stripTrailingCommas(text)
      .split(/(\r\n|\r|\n)/)
      .map((t) => t.trim())
      .filter((v) => v.length > 0);

    // # Check if the json is valid.
    void JSON.parse(lines0.filter(_notComment).join(''));

    // # Whole file level comments
    const start = lines0.findIndex(_notComment);
    const end = lines0.findLastIndex(_notComment);
    // ! Must be done first, or indexes will change.
    if (end !== -1 && end < lines0.length - 1) {
      this.bottom = lines0.splice(end + 1).map(_stripPrefix);
    }
    if (start > 0) {
      this.top = lines0.splice(0, start).map(_stripPrefix);
    }

    const { lines, unames } = mark(aggregate(lines0));
    this.data = reviver ? JSON.parse(lines.join(''), reviver) : JSON.parse(lines.join(''));
    console.log(this.data);
    // TODO visit会去掉data的uname字段，现在改造，要保留它
    this.comments = visit(this.data, unames);
  }

  /**
   * Set entry for a property path.
   * - set `entry.comments` to `[]` to remove them.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param entry Optional `value` and `comments` properties. Will set the provided ones.
   *
   */
  set(propPath: string | string[], entry: Partial<Entry>): this {
    const k = _split(propPath);
    if ('value' in entry) {
      _set(this.data, k, entry.value);
    }

    const comments = entry.comments;
    if (comments) {
      if (!_isArray(comments)) {
        throw new TypeError(`Invalid comments, must be string[].`);
      }
      if (comments.length === 0) {
        _delete(this.comments, k);
      } else {
        _set(this.comments, k, comments);
      }
    }
    return this;
  }

  /**
   * Get entry for a property path.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   */
  get(propPath: string | string[]): Entry | undefined {
    const k = _split(propPath);
    const v = _get(this.data, k);
    return v === undefined ? undefined : { value: v, comments: _get(this.comments, k) };
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
    const k = _split(propPath);
    const arr = _get(this.data, k);
    if (!_isArray(arr)) {
      throw new TypeError(`The property path "${propPath}" is not an array.`);
    }
    arrayOpers[method](arr, args as any, this.comments, k);
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
    const lines = serialize(this.comments, this.data, space ?? 2, replacer ?? null);
    const bottom = this.bottom.map((v) => `${COMMENT_PREFIX} ${v}`);

    return top.concat(lines, bottom).join('\n');
  }

  /**
   * Return a pure js object, stripping all comment artifacts.
   * - The internal data is already clean (uuid keys removed by visit),
   *   so this is a simple deep clone.
   */
  toObject<T = any>(): T {
    return structuredClone(this.data) as T;
  }

  /**
   * Release the references, clear internal containers.
   */
  destroy() {
    this.comments.clear();
    this.top = null as any;
    this.bottom = null as any;
    this.data = null as any;
    this.comments = null as any;
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
