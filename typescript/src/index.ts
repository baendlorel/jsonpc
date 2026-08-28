import { ReflectDeep } from 'reflect-deep';
import { _isArray, COMMENT_PREFIX } from './common.js';
import {
  isComment,
  aggregate,
  normalizeLines,
  stripTopBottom,
  stripPrefix,
  mark,
  visit,
  clone,
  validComments,
} from './core.js';
import { PathMap } from './path-map.js';

export class JSONWithPropertyComment {
  /**
   * Comments at the top of the file, before any json content.
   */
  private top: string[] = [];

  /**
   * Comments at the bottom of the file, after any json content.
   */
  private bottom: string[] = [];

  /** Maps property path (string[]) → comment content lines (string[], without `//` prefix) */
  private commentMap: PathMap = new PathMap();

  private data: any;

  /**
   * This is actually the parser
   * @param text json text
   */
  constructor(text: string) {
    const lines = normalizeLines(text);
    const withoutComments = lines.filter((v) => !isComment(v));
    const rawJson = withoutComments.join('');
    try {
      JSON.parse(rawJson);
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
  setComments(propPath: string, comments: string[]) {
    if (!validComments(comments)) {
      throw new Error(`Comments must be an array of strings, got: ${typeof comments}`);
    }
    this.commentMap.set(propPath.split('.'), comments);
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

  set(propPath: string, value: any, comments?: string[]) {
    ReflectDeep.set(this.data, propPath.split('.'), value);
    if (validComments(comments)) {
      this.setComments(propPath, comments);
    } else if (comments !== undefined) {
      throw new Error(`Comments must be an array of strings, got: ${typeof comments}`);
    }
  }

  get(propPath: string, defaultValue?: any) {
    return ReflectDeep.get(this.data, propPath.split('.')) ?? defaultValue;
  }

  /**
   * Convert the data back to json text, with comments.
   * - Like `JSON.stringify(data, null, 2)`.
   * - Definitely change lines.
   *
   * @param replacer Like the replacer in `JSON.stringify`, default is `undefined`.
   * @param space default is 2.
   */
  stringify(replacer?: (this: any, key: string, value: any) => any, space?: number) {
    const pad = space ?? 2;

    const lines: string[] = [];

    /**
     * Serialize a value, appending lines to `lines`.
     * @param path current property path (string[]) for comment lookup
     */
    const serialize = (obj: any, depth: number, path: string[] = []): void => {
      const prefix = ' '.repeat(depth * pad);

      if (obj === null || typeof obj !== 'object') {
        lines.push(`${prefix}${JSON.stringify(obj)}`);
        return;
      }

      if (_isArray(obj)) {
        if (obj.length === 0) {
          lines.push(`${prefix}[]`);
          return;
        }
        lines.push(`${prefix}[`);
        for (let i = 0; i < obj.length; i++) {
          const val = replacer ? replacer.call(obj, String(i), obj[i]) : obj[i];
          const isLast = i === obj.length - 1;
          serialize(val, depth + 1, path.concat(String(i)));
          if (!isLast) {
            lines[lines.length - 1] += ',';
          }
        }
        lines.push(`${prefix}]`);
        return;
      }

      // Plain object
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        lines.push(`${prefix}{}`);
        return;
      }

      lines.push(`${prefix}{`);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = replacer ? replacer.call(obj, key, obj[key]) : obj[key];
        const isLast = i === keys.length - 1;
        const propPath = path.concat(key);

        // Emit comments before this property
        (this.commentMap.get(propPath) as string[])?.forEach((c) =>
          lines.push(`${' '.repeat((depth + 1) * pad)}${COMMENT_PREFIX}${c}`),
        );

        // Emit the property key
        const keyLine = `${' '.repeat((depth + 1) * pad)}"${key}":`;
        lines.push(keyLine);

        // Serialize the value — for primitives, inline on the same line
        const isObj = val !== null && typeof val === 'object';
        if (!isObj) {
          lines[lines.length - 1] += JSON.stringify(val);
        } else {
          serialize(val, depth + 1, propPath);
        }

        // Add trailing comma if not last
        if (!isLast) {
          lines[lines.length - 1] += ',';
        }
      }
      lines.push(`${prefix}}`);
    };

    // Top-level file comments
    this.top.forEach((c) => lines.push(`${COMMENT_PREFIX}${c}`));

    serialize(this.data, 0);

    // Bottom-level file comments
    this.bottom.forEach((c) => lines.push(`${COMMENT_PREFIX}${c}`));

    return lines.join('\n');
  }

  /**
   * Return a pure js object, stripping all comment artifacts.
   * - The internal data is already clean (uuid keys removed by visit),
   *   so this is a simple deep clone.
   */
  toJSON<T = any>(): T {
    return clone(this.data) as T;
  }

  /**
   * Transform to standard JSON string without comments.
   * Equal to `JSON.stringify(this.toJSON(), null, 2)`.
   */
  toJSONString(replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
  toJSONString(...args: any[]) {
    return JSON.stringify(this.toJSON(), ...args);
  }
}
