import { randomUUID } from 'node:crypto';
import { PathMap } from './path-map.js';
import { _isArray } from './common.js';

export function isComment(t: string) {
  return t.startsWith('//');
}

export function validComments(comments: any): comments is string[] {
  return _isArray(comments) && comments.every((c) => typeof c === 'string');
}

export function stripPrefix(t: string): string {
  return t.replace(/^\/\/\s?/, '');
}

export function normalizeLines(text: string) {
  return text
    .split(/(\r\n|\r|\n)/)
    .map((t) => t.trim())
    .filter((v) => v.length > 0);
}

export function stripTopBottom(lines: string[]) {
  let top = NaN;
  for (let i = 0; i < lines.length; i++) {
    if (isComment(lines[i])) {
      top = i;
    } else {
      break;
    }
  }

  let bottom = NaN;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isComment(lines[i])) {
      bottom = i;
    } else {
      break;
    }
  }

  return { top, bottom };
}

/**
 * Multiple comment lines will be collapsed into a string array.
 * Comment prefix `//` is stripped from each line.
 */
export function aggregate(lines: string[]): Array<string | string[]> {
  const modified: Array<string | string[]> = [];
  let array: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isComment(lines[i])) {
      if (array.length === 0) {
        modified.push(array);
      }
      array.push(stripPrefix(lines[i]));
    } else {
      array = [];
      modified.push(lines[i]);
    }
  }

  return modified;
}

function nextNonSpaceIsColon(line: string, start: number) {
  for (let i = start; i < line.length; i++) {
    if (line[i] === ' ') {
      continue;
    } else if (line[i] === ':') {
      return true;
    } else {
      return false;
    }
  }
  return false;
}

export function interpretName(line: string) {
  if (line[0] !== '"') {
    throw new Error(`Comments are only allowed directly above property names`);
  }
  if (line.startsWith('""')) {
    return '';
  }
  if (line.length <= 3) {
    throw new Error(`Invalid line: ${line}`);
  }

  const chars: string[] = [];
  let escaping = false;
  let finish = false;
  for (let i = 1; i < line.length; i++) {
    const c = line[i];
    if (escaping) {
      escaping = false;
      continue;
    }

    if (c === '\\') {
      escaping = true;
    } else if (c === '"' && nextNonSpaceIsColon(line, i + 1)) {
      finish = true;
      break;
    } else {
      chars.push(c);
    }
  }

  if (!finish) {
    throw new Error(`Cannot find 2nd '"': ${line}`);
  }

  return chars.join('');
}

export function uuidName(origin: string) {
  return origin + '_' + randomUUID();
}

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
 * @param path property name path for ReflectDeep
 * @param map returned map
 */
export function visit(o: any, unames: Map<string, string>, path: string[] = [], map: PathMap = new PathMap()) {
  for (const key in o) {
    const origin = unames.get(key);
    const v = o[key];

    // & If the key is a uuid name, we will use the original name
    // & to map to the value.
    if (origin) {
      // Store the comments outside the object.
      delete o[key];
      map.set(path.concat(origin), v);
      if (typeof v === 'object') {
        visit(v, unames, path.concat(key), map);
      }
    } else if (_isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        visit(v[i], unames, path.concat(key, i.toString()), map);
      }
    } else if (typeof v === 'object') {
      visit(v, unames, path.concat(key), map);
    } else {
      // primitives, do nothing
    }
  }
  return map;
}

export const clone: <T = any>(o: T) => T =
  structuredClone ??
  function <T = any>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (_isArray(obj)) {
      return obj.map(clone) as any;
    }
    const result: Record<string, any> = {};
    for (const key in obj) {
      result[key] = clone(obj[key]);
    }
    return result as T;
  };
