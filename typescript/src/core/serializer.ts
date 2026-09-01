import { _isArray, _isObject, _keys, _stringify } from './common.js';
import { _get } from './path-map.js';
import { Value } from './value.js';

const appendLast = (lines: string[], s: string) => (lines[lines.length - 1] += s);
const isArrayStart = (lines: string[]) => lines.length === 0 || lines[lines.length - 1].endsWith('[');

/**
 * Serialize a value, appending lines to `lines`.
 * @param path current property path (string[]) for comment lookup
 */
export function serialize(
  data: any,
  pad: number,
  replacer: (this: any, key: string, value: any) => any,
  depth: number = 0,
  path: any[] = [],
  lines: string[] = [],
): string[] {
  const prefix = ' '.repeat(depth * pad);

  // # Primitive
  if (!_isObject(data)) {
    lines.push(`${prefix}${_stringify(data, null, pad)}`);
    return lines;
  }

  // # Array
  if (_isArray(data)) {
    if (data.length === 0) {
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

    for (let i = 0; i < data.length; i++) {
      const subdata = replacer.call(data, String(i), data[i]);
      serialize(subdata, pad, replacer, depth + 1, [...path, i], lines);

      // * trailing comma for array elements
      appendLast(lines, `,`);
    }
    lines.push(`${prefix}]`);
    return lines;
  }

  // # Plain object
  const keys = _keys(data);
  if (keys.length === 0) {
    lines.push(`${prefix}{}`);
    return lines;
  }

  // find
  const entries = keys.map((k) => {
    const r = data[k];

    return {
      k,
      v: replacer.call(data, k, r instanceof Value ? r.value : r),
      c: r instanceof Value ? r.comments : null,
      p: path.concat(k),
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
    let { k, v, c, p } = active[i];

    if (c) {
      c.forEach((c: string) => lines.push(`${indent}${COMMENT_PREFIX} ${c}`));
    }

    // Emit the property key
    const keyLine = `${indent}"${k}": `;
    lines.push(keyLine);

    if (_isObject(v)) {
      serialize(v, pad, replacer, depth + 1, p, lines);
    } else {
      appendLast(lines, _stringify(v, replacer as any, pad));
    }

    // * trailing comma for array elements
    appendLast(lines, ',');
  }
  lines.push(`${prefix}}`);
  return lines;
}
