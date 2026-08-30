import { get as _get, set as _set } from 'reflect-deep';
import { _isArray, _keys, _notComment, _stripPrefix } from './common.js';
import { interpretName } from '../walkers/interpret-name.js';

/**
 * Multiple comment lines will be collapsed into a string array.
 * Comment prefix `//` is stripped from each line.
 */
export function aggregate(lines: string[]): Array<string | string[]> {
  const modified: Array<string | string[]> = [];
  let array: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (_notComment(lines[i])) {
      array = [];
      modified.push(lines[i]);
    } else {
      if (array.length === 0) {
        modified.push(array);
      }
      array.push(_stripPrefix(lines[i]));
    }
  }

  return modified;
}

const r = () => Math.random() * 43 + 48;
export const uniqueName = (origin: string) => origin + String.fromCharCode(r(), r(), r(), r(), r(), r(), r());

/**
 * Marks property with comments into a uniqueName, so that
 * we can associate the right property with right comments.
 * @param aggregated muiltiple comments are collapsed into `string[]`.
 */
export function mark(aggregated: Array<string | string[]>) {
  // Maps unique name to the original name
  const unames = new Map<string, string>();
  const lines = aggregated.map((v, i) => {
    if (typeof v === 'string') {
      // Return if it's a normal line, not a comment line
      return v;
    }

    const origin = interpretName(aggregated[i + 1] as string);
    const uname = uniqueName(origin);
    // ! At this point, we don't know the full property path of
    // ! this comment yet, so we use unique names to mark them
    unames.set(uname, origin);
    return `"${uname}":${JSON.stringify(v)},`;
  });

  return { lines, unames };
}

/**
 * Deep visit, collect prop path.
 * @param o the parsed object
 * @param unames uname -> original name map
 * @param path property name path
 * @param comments returned map
 */
export function visit(o: any, unames: Map<string, string>, path: string[] = [], comments: any = {}) {
  for (const k in o) {
    const origin = unames.get(k);
    const v = o[k];
    // & If the key is a uuid name, we will use the original name
    // & to map to the value.
    if (origin) {
      // Store the comments outside the object.
      delete o[k];
      const nextPath = path.concat(origin);
      _set(comments, nextPath, v);
      if (typeof v === 'object') {
        visit(v, unames, nextPath, comments);
      }
    } else if (_isArray(v)) {
      const arr: any[] = [];
      const nextPath = path.concat(k);
      _set(comments, nextPath, arr);
      for (let i = 0; i < v.length; i++) {
        visit(v[i], unames, nextPath.concat(String(i)), comments);
      }
    } else if (typeof v === 'object') {
      visit(v, unames, path.concat(k), comments);
    } else {
      // primitives, do nothing
    }
  }
  return comments;
}

/**
 * Serialize a value, appending lines to `lines`.
 * @param path current property path (string[]) for comment lookup
 */
export function serialize(
  commentMap: any,
  obj: any,
  pad: number,
  replacer: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
  depth: number = 0,
  path: string[] = [],
  lines: string[] = [],
): string[] {
  const prefix = ' '.repeat(depth * pad);

  if (obj === null || typeof obj !== 'object') {
    lines.push(`${prefix}${JSON.stringify(obj, null, pad)}`);
    return lines;
  }

  if (_isArray(obj)) {
    if (obj.length === 0) {
      lines[lines.length - 1] += `[]`;
      return lines;
    }

    /**
     * @see same logic about '{' below.
     */
    if (lines.length === 0 || lines[lines.length - 1].endsWith('[')) {
      lines.push(`${prefix}[`);
    } else {
      lines[lines.length - 1] += `[`;
    }

    for (let i = 0; i < obj.length; i++) {
      const val = typeof replacer === 'function' ? replacer.call(obj, String(i), obj[i]) : obj[i];
      serialize(commentMap, val, pad, replacer, depth + 1, path.concat(String(i)), lines);

      // * trailing comma for array elements
      lines[lines.length - 1] += ',';
    }
    lines.push(`${prefix}]`);
    return lines;
  }

  // Plain object
  const keys = _keys(obj);
  if (keys.length === 0) {
    lines.push(`${prefix}{}`);
    return lines;
  }

  // Collect entries with their values resolved through replacer
  interface Entry {
    key: string;
    val: any;
    skipped: boolean;
    propPath: string[];
  }
  const entries: Entry[] = keys.map((key) => {
    const val = typeof replacer === 'function' ? replacer.call(obj, key, obj[key]) : obj[key];
    return {
      key,
      val,
      skipped: val === undefined,
      propPath: path.concat(key),
    };
  });

  const active = entries.filter((e) => !e.skipped);

  if (active.length === 0) {
    lines[lines.length - 1] += `{}`;
    return lines;
  }

  /**
   * This makes:
   * ```js
   * {
   *  "ddd": {
   *  }
   * }
   * ```
   * instead of:
   * ```js
   * {
   *   "ddd":
   *   {
   *   }
   * }
   */
  if (lines.length === 0 || lines[lines.length - 1].endsWith('[')) {
    lines.push(`${prefix}{`);
  } else {
    lines[lines.length - 1] += `{`;
  }

  const indent = ' '.repeat((depth + 1) * pad);
  for (let i = 0; i < active.length; i++) {
    const { key, val, propPath } = active[i];

    // Emit comments before this property
    _get(commentMap, propPath)?.forEach((c: string) => lines.push(`${indent}${COMMENT_PREFIX} ${c}`));

    // Emit the property key
    const keyLine = `${indent}"${key}": `;
    lines.push(keyLine);

    // Serialize the value — for primitives, inline on the same line
    const isObj = val !== null && typeof val === 'object';
    if (!isObj) {
      lines[lines.length - 1] += JSON.stringify(val, replacer as any, pad);
    } else {
      serialize(commentMap, val, pad, replacer, depth + 1, propPath, lines);
    }

    // * trailing comma for array elements
    lines[lines.length - 1] += ',';
  }
  lines.push(`${prefix}}`);
  return lines;
}
