import { interpretName } from '../walkers/interpret-name.js';
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
      u.set(uname, new Value(valueOrComments, interpretName(aggregated[i + 1] as string)));
      return `"${uname}":"",`;
    })
    .join('\n');

  console.log('aggregated text version', t);

  // FIXME  问题在于，注释下一个如果是对象，那么不会先解析这个对象的key，而是钻进对象里面，去解析子对象的第一个key。

  const stack: Array<{ o: any; v: Value }> = [];
  const data = JSON.parse(t, function (this: any, key: string, value: any) {
    u.has(key) && console.log('正在解析', key);

    const last = stack[stack.length - 1];
    if (last?.o === this && last.v.origin === key) {
      stack.pop();
      return last.v.value;
    }

    const v = u.get(key);
    if (!v) {
      return reviver.call(this, key, value);
    }
    stack.push({ o: this, v });
    return undefined;
  });

  u.clear();

  return data;
}
