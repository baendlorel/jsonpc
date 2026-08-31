import { _isArray, _keys, _notComment, _stripPrefix } from './common.js';
import { _set, _get, _delete } from './path-map.js';
import { genUname } from './uname.js';

import { UnameKeyMap, Value } from './value.js';

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
export function interpret(aggregated: Array<string | string[]>, reviver: (this: any, key: string, value: any) => any) {
  const u: UnameKeyMap = new Map();
  const t = aggregated
    .map((valueOrComments, i) => {
      if (typeof valueOrComments === 'string') {
        return valueOrComments; // Return if it's a normal line
      }

      const uname = genUname();
      u.set(uname, new Value(valueOrComments));
      return `"${uname}":"",`;
    })
    .join('');

  let next = null as Value | null;
  const data = JSON.parse(t, function (this: any, key: string, value: any) {
    if (next) {
      next.value = value;
      value = next;
      next = null;
      return value;
    }

    const v = u.get(key);
    if (!v) {
      return reviver.call(this, key, value);
    }
    next = v;
    return undefined;
  });

  u.clear();

  return data;
}
