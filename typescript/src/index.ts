import { ReflectDeep } from 'reflect-deep';
import {
  isComment,
  aggregateComments,
  normalizeLines,
  stripTopBottom,
  convertCommentsToProperties,
  type PropMap,
  visit,
  uuidName,
} from './core.js';
import { COMMENT_SUFFIX } from './consts.js';

export class JSONWithPropertyComment {
  private topComments: string[] = [];
  private bottomComments: string[] = [];

  private propMap: PropMap;

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
      this.bottomComments = lines.splice(stripIndex.bottom); //! Must be done first, or indexes will change.
    }
    if (!Number.isNaN(stripIndex.top)) {
      this.topComments = lines.splice(0, stripIndex.top + 1);
    }

    const aggregated = aggregateComments(lines);
    const named = convertCommentsToProperties(aggregated);
    this.data = JSON.parse(named.lines.join(''));
    this.propMap = visit(this.data, named.names);
  }

  private resolve(propPath: string) {
    const k = propPath.split('.');
    const kstr = JSON.stringify(k);
    return { k, kstr, p: this.propMap.get(kstr) };
  }

  /**
   * Set comment for a property path.
   * - if the property path does not exist, it will be created as `null`.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   * @param comments comments array
   */
  setComments(propPath: string, comments: string[]) {
    const { k, kstr, p } = this.resolve(propPath);

    if (p) {
      k[k.length - 1] = p.current + COMMENT_SUFFIX;
      ReflectDeep.set(this.data, k, comments);
    } else {
      const value = ReflectDeep.get(this.data, k);
      ReflectDeep.deleteProperty(this.data, k);

      const origin = k[k.length - 1];
      const current = uuidName(origin);

      k[k.length - 1] = current;
      ReflectDeep.set(this.data, k, value);

      k[k.length - 1] = current + COMMENT_SUFFIX;
      ReflectDeep.set(this.data, k, comments);

      this.propMap.set(kstr, { origin, current });
    }
  }

  /**
   * Get comment for a property path.
   * Return `undefined` if the property path does not exist.
   * @param propPath like `"a.b.c.0.1"`, will be resolved by `.split('.')`
   */
  getComments(propPath: string): string[] | undefined {
    const { k, p } = this.resolve(propPath);
    if (!p) {
      return undefined;
    }

    k[k.length - 1] = p.current + COMMENT_SUFFIX;
    return ReflectDeep.get(this.data, k);
  }

  set(propPath: string, value: any) {
    const k = propPath.split('.');
    const kstr = JSON.stringify(k);
    const exists = this.propMap.get(kstr);
    if (exists) {
      k[k.length - 1] = exists.current;
    }
    ReflectDeep.set(this.data, k, value);
  }

  get(propPath: string, defaultValue?: any) {
    const { k, p } = this.resolve(propPath);
    if (p) {
      k[k.length - 1] = p.current;
    }
    return ReflectDeep.get(this.data, k) ?? defaultValue;
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

    // Build reverse map: currentName → originName
    const reverseNameMap = new Map<string, string>();
    for (const [, v] of this.propMap) {
      reverseNameMap.set(v.current, v.origin);
    }

    const lines: string[] = [];

    /**
     * Serialize a value, appending lines to `lines`.
     * @returns the index of the last line appended for this value.
     */
    const serialize = (obj: any, depth: number): number => {
      const prefix = ' '.repeat(depth * pad);

      if (obj === null || typeof obj !== 'object') {
        lines.push(`${prefix}${JSON.stringify(obj)}`);
        return lines.length - 1;
      }

      if (Array.isArray(obj)) {
        if (obj.length === 0) {
          lines.push(`${prefix}[]`);
          return lines.length - 1;
        }
        lines.push(`${prefix}[`);
        for (let i = 0; i < obj.length; i++) {
          const val = replacer ? replacer.call(obj, String(i), obj[i]) : obj[i];
          const isLast = i === obj.length - 1;
          serialize(val, depth + 1);
          if (!isLast) {
            lines[lines.length - 1] += ',';
          }
        }
        lines.push(`${prefix}]`);
        return lines.length - 1;
      }

      // Plain object
      const keys = Object.keys(obj).filter((k) => !k.endsWith(COMMENT_SUFFIX));
      if (keys.length === 0) {
        lines.push(`${prefix}{}`);
        return lines.length - 1;
      }

      lines.push(`${prefix}{`);
      for (let i = 0; i < keys.length; i++) {
        const uuidKey = keys[i];
        const originKey = reverseNameMap.get(uuidKey) ?? uuidKey;
        const val = replacer ? replacer.call(obj, originKey, obj[uuidKey]) : obj[uuidKey];
        const isLast = i === keys.length - 1;

        // Emit comments before this property
        const commentKey = uuidKey + COMMENT_SUFFIX;
        const comments = obj[commentKey];
        if (Array.isArray(comments)) {
          for (const c of comments) {
            lines.push(`${' '.repeat((depth + 1) * pad)}${c}`);
          }
        }

        // Emit the property key
        const keyLine = `${' '.repeat((depth + 1) * pad)}"${originKey}":`;
        lines.push(keyLine);

        // Serialize the value — for primitives, inline on the same line
        const isObj = val !== null && typeof val === 'object';
        if (!isObj) {
          // Append primitive value on the same line as the key
          const str = JSON.stringify(val);
          lines[lines.length - 1] += str;
        } else {
          serialize(val, depth + 1);
        }

        // Add trailing comma if not last
        if (!isLast) {
          lines[lines.length - 1] += ',';
        }
      }
      lines.push(`${prefix}}`);
      return lines.length - 1;
    };

    // Top-level file comments
    for (const c of this.topComments) {
      lines.push(c);
    }

    serialize(this.data, 0);

    // Bottom-level file comments
    for (const c of this.bottomComments) {
      lines.push(c);
    }

    return lines.join('\n');
  }

  /**
   * Return a pure js object, stripping all comment/uuid artifacts.
   * - UUID'd keys are replaced with their original names.
   * - `_comments` keys are removed entirely.
   * - Nested structures are handled recursively.
   */
  toJSON<T = any>(): T {
    const reverseNameMap = new Map<string, string>();
    for (const [, v] of this.propMap) {
      reverseNameMap.set(v.current, v.origin);
    }

    const clean = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(clean);
      }

      const result: Record<string, any> = {};
      for (const key of Object.keys(obj)) {
        if (key.endsWith(COMMENT_SUFFIX)) {
          continue; // skip comment artifacts
        }
        const originKey = reverseNameMap.get(key) ?? key;
        result[originKey] = clean(obj[key]);
      }
      return result;
    };

    return clean(this.data) as T;
  }

  /**
   * Equal to `JSON.stringify(this.toJSON(), null, 2)`.
   */
  toJSONString(replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
  toJSONString(...args: any[]) {
    return JSON.stringify(this.toJSON(), ...args);
  }
}
