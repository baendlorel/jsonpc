import { get as _get, set as _set } from 'reflect-deep';
import { _isArray, _keys } from './common.js';
import { walk, Side, WalkerHandlerArgsWithSides } from './walker.js';

export const notComment = (t: string) => !t.startsWith(COMMENT_PREFIX);

export const split = (path: string | string[]): string[] => {
  if (typeof path === 'string') {
    return path.split('.');
  }
  if (_isArray(path) && path.length > 0) {
    return path;
  }
  throw new TypeError(`Invalid propPath, must be string | string[].`);
};

export const stripPrefix = (t: string) => t.replace(COMMENT_PREFIX, '').trimStart();
/**
 * Multiple comment lines will be collapsed into a string array.
 * Comment prefix `//` is stripped from each line.
 */
export function aggregate(lines: string[]): Array<string | string[]> {
  const modified: Array<string | string[]> = [];
  let array: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (notComment(lines[i])) {
      array = [];
      modified.push(lines[i]);
    } else {
      if (array.length === 0) {
        modified.push(array);
      }
      array.push(stripPrefix(lines[i]));
    }
  }

  return modified;
}

const enum WalkState {
  Idle,
  Start,
  Searching,
  Found,
}

export function interpretName(line: string) {
  if (line[0] !== '"') {
    throw new Error(`Comments are only allowed directly above property names`);
  }
  const chars: string[] = [];
  let state = WalkState.Idle;
  walk(line, {
    start: 1,
    inString: true,
    onStringContent: ({ c }) => chars.push(c),
    onQuote({ side }) {
      if (side === Side.Right) {
        state = WalkState.Start;
      }
    },
    afterChar({ c }, stop) {
      switch (state) {
        case WalkState.Idle:
          break;
        case WalkState.Start:
          state = WalkState.Searching;
          break;
        case WalkState.Searching:
          if (c === ':') {
            state = WalkState.Found;
            stop();
            return;
          } else if (c.trim() !== '') {
            throw new Error(`Unexpected character after property name: ${line}`);
          }
          break;
        case WalkState.Found: // This won't happen, but just in case.
          stop();
          break;
      }
    },
  });

  if ((state as WalkState) !== WalkState.Found) {
    throw new Error(`Cannot find ending quote: ${line}`);
  }

  return chars.join('');
}

/**
 * Scan the whole text, and remove trailing commas.
 *
 * **This function is based on the concepts below:**
 * 1. Trailing commas will only appear before `}` or `]`.
 * 2. Trailing commas will not appear in string literals.
 * 3. Comments satisfies the rules of JSONPC.
 */
export function stripTrailingCommas(text: string) {
  const chars: (string | null)[] = text.split('');

  let lastCommaIndex = -1;
  let state: WalkState = WalkState.Idle;

  const onBrace = ({ side }: WalkerHandlerArgsWithSides) => {
    if (side === Side.Right && state === WalkState.Searching) {
      state = WalkState.Found;
    }
  };

  walk(text, {
    onComma({ i }) {
      state = WalkState.Start;
      lastCommaIndex = i;
    },
    onBrace,
    onBracket: onBrace,
    afterChar({ c }) {
      switch (state) {
        case WalkState.Idle:
          break;
        case WalkState.Start:
          state = WalkState.Searching;
          break;
        case WalkState.Searching:
          if (c.trim() !== '') {
            state = WalkState.Idle;
          }
          break;
        case WalkState.Found:
          state = WalkState.Idle;
          chars[lastCommaIndex] = null;
          break;
      }
    },
  });

  return chars.filter((c) => c !== null).join('');
}

const r = () => Math.random() * 43 + 48;
export const uuidName = (origin: string) => origin + String.fromCharCode(r(), r(), r(), r(), r(), r(), r());

/**
 * Marks property with comments into a uuidName, so that
 * we can associate the right property with right comments.
 * @param aggregated muiltiple comments are collapsed into `string[]`.
 */
export function mark(aggregated: Array<string | string[]>) {
  // Maps uuid name to the original name
  const unames = new Map<string, string>();
  const lines = aggregated.map((v, i) => {
    if (typeof v === 'string') {
      // Return if it's a normal line, not a comment line
      return v;
    }

    const origin = interpretName(aggregated[i + 1] as string);
    const uname = uuidName(origin);
    // ! At this point, we don't know the full property path of
    // ! this comment yet, so we use uuid names to mark them
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
 * @param commentMap returned map
 */
export function visit(o: any, unames: Map<string, string>, path: string[] = [], commentMap: any = {}) {
  for (const k in o) {
    const origin = unames.get(k);
    const v = o[k];
    // & If the key is a uuid name, we will use the original name
    // & to map to the value.
    if (origin) {
      // Store the comments outside the object.
      delete o[k];
      const nextPath = path.concat(origin);
      _set(commentMap, nextPath, v);
      if (typeof v === 'object') {
        visit(v, unames, nextPath, commentMap);
      }
    } else if (_isArray(v)) {
      const arr: any[] = [];
      const nextPath = path.concat(k);
      _set(commentMap, nextPath, arr);
      for (let i = 0; i < v.length; i++) {
        visit(v[i], unames, nextPath.concat(String(i)), commentMap);
      }
    } else if (typeof v === 'object') {
      visit(v, unames, path.concat(k), commentMap);
    } else {
      // primitives, do nothing
    }
  }
  return commentMap;
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
