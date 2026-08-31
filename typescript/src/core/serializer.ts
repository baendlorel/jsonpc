import { _isArray, _keys, _stringify } from './common.js';
import { _get, type UnameMap } from './path-map.js';

// Collect entries with their values resolved through replacer
interface Entry {
  k: string;
  v: any;
  path: string[];
}

const appendLast = (lines: string[], s: string) => (lines[lines.length - 1] += s);
const isArrayStart = (lines: string[]) => lines.length === 0 || lines[lines.length - 1].endsWith('[');

/**
 * Serialize a value, appending lines to `lines`.
 * @param path current property path (string[]) for comment lookup
 */
export function serialize(
  comments: UnameMap,
  obj: any,
  pad: number,
  replacer: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
  depth: number = 0,
  path: any[] = [],
  lines: string[] = [],
): string[] {
  const prefix = ' '.repeat(depth * pad);

  // # Primitive
  if (obj === null || typeof obj !== 'object') {
    lines.push(`${prefix}${_stringify(obj, null, pad)}`);
    return lines;
  }

  // # Array
  if (_isArray(obj)) {
    if (obj.length === 0) {
      appendLast(lines, `[]`);
      return lines;
    }

    /**
     * @see same logic about '{' below.
     */
    if (isArrayStart(lines)) {
      lines.push(`${prefix}[`);
    } else {
      appendLast(lines, `[`);
    }

    for (let i = 0; i < obj.length; i++) {
      const val = typeof replacer === 'function' ? replacer.call(obj, String(i), obj[i]) : obj[i];
      serialize(comments, val, pad, replacer, depth + 1, [...path, i], lines);

      // * trailing comma for array elements
      appendLast(lines, `,`);
    }
    lines.push(`${prefix}]`);
    return lines;
  }

  // # Plain object
  const keys = _keys(obj);
  if (keys.length === 0) {
    lines.push(`${prefix}{}`);
    return lines;
  }

  const entries: Entry[] = keys.map((k) => {
    const v = typeof replacer === 'function' ? replacer.call(obj, k, obj[k]) : obj[k];
    return {
      k,
      v,
      path: path.concat(k),
    };
  });

  const active = entries.filter((e) => e.v !== undefined);

  if (active.length === 0) {
    appendLast(lines, `{}`);
    return lines;
  }

  /**
   * # This makes:
   *  "ddd": {
   *  }
   * instead of:
   *   "ddd":
   *   {
   *   }
   */
  if (isArrayStart(lines)) {
    lines.push(`${prefix}{`);
  } else {
    appendLast(lines, `{`);
  }

  const indent = ' '.repeat((depth + 1) * pad);
  for (let i = 0; i < active.length; i++) {
    const { k: key, v: val, path: propPath } = active[i];

    // Emit comments before this property
    _getComment(comments, propPath)?.forEach((c: string) => lines.push(`${indent}${COMMENT_PREFIX} ${c}`));

    // Emit the property key
    const keyLine = `${indent}"${key}": `;
    lines.push(keyLine);

    // Serialize the value — for primitives, inline on the same line
    const isObj = val !== null && typeof val === 'object';
    if (!isObj) {
      appendLast(lines, _stringify(val, replacer as any, pad));
    } else {
      serialize(comments, val, pad, replacer, depth + 1, propPath, lines);
    }

    // * trailing comma for array elements
    appendLast(lines, ',');
  }
  lines.push(`${prefix}}`);
  return lines;
}
