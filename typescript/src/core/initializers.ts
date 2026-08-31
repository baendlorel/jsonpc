import { _isArray, _keys, _notComment, _stringify, _stripPrefix } from './common.js';
import { _set, _get, _delete } from './path-map.js';
import { genUname } from './uname.js';

import { interpretName } from '../walkers/interpret-name.js';
import { UnameKeyMap, Value, ValueMap } from './value.js';

/**
 * Multiple comment lines will be collapsed into a string array.
 * Comment prefix `//` is stripped from each line.
 */
export function aggregate(lines: string[]): Array<string | string[]> {
  const result: Array<string | string[]> = [];
  let comments: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (_notComment(lines[i])) {
      comments = null;
      result.push(lines[i]);
    } else {
      if (!comments) {
        result.push((comments = []));
      }
      comments.push(_stripPrefix(lines[i]));
    }
  }

  return result;
}

/**
 * Marks property with comments into a uniqueName, so that
 * we can associate the right property with right comments.
 * @param aggregated muiltiple comments are collapsed into `string[]`.
 */
export function mark(aggregated: Array<string | string[]>) {
  const umap: UnameKeyMap = new Map();
  const vmap: ValueMap = new Map();
  const lines = aggregated.map((valueOrComments, i) => {
    if (typeof valueOrComments === 'string') {
      return valueOrComments; // Return if it's a normal line
    }

    const uname = genUname();
    const vi = new Value(valueOrComments, interpretName(aggregated[i + 1] as string));

    umap.set(uname, vi);
    vmap.set(vi.sym, vi);

    return `"${uname}":"",`;
  });

  return { t: lines.join(''), u: umap, v: vmap };
}

export const visit = (data: any, unames: UnameKeyMap) => {
  if (typeof data !== 'object' || data === null) {
    return;
  }

  if (_isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      visit(data[i], unames);
    }
    return;
  }

  const visited = new Set<string>();
  for (const key in data) {
    if (visited.has(key)) {
      continue;
    }

    const v = unames.get(key);
    if (v) {
      v.value = data[v.origin];
      data[v.origin] = v.sym; // Use symbol to identify the commented property
      visited.add(v.origin);
      delete data[key];
      visit(v.value, unames);
    } else {
      visit(data[key], unames);
    }
  }
};
