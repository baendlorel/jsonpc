import { interpretName } from '../walkers/interpret-name.js';
import { MiniWalker } from '../walkers/mini-walker.js';
import { _isArray, _keys, _notComment, _stripPrefix } from './common.js';
import { _set, _get, _delete } from './path-map.js';
import { DT_TAG, genUname, NaN_TAG } from './uname.js';
import { type UnameKeyMap, Value } from './value.js';

/** Convert tagged strings back to their real JS values after JSON.parse. */
function _unwrapTag(value: any): any {
  if (typeof value !== 'string') return value;
  if (value === NaN_TAG) return NaN;
  if (value.startsWith(DT_TAG)) return new Date(value.slice(DT_TAG.length));
  return value;
}

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
  const text0 = aggregated
    .map((valueOrComments, i) => {
      if (typeof valueOrComments === 'string') {
        return valueOrComments; // Return if it's a normal line
      }

      const uname = genUname();
      const origin = interpretName(aggregated[i + 1] as string);
      u.set(uname, new Value(valueOrComments, origin));

      // & value of the uname key is the original key, make it easier to find the right property when parsing.
      return `"${uname}":"${origin}",`;
    })
    .join('\n');

  const walker = new MiniWalker({
    text: text0,
    inString: false,
    onValue: ({ i, c, t, s, v }) => {
      if (v === 'NaN') {
        walker.replace(s, s + v.length, `"${NaN_TAG}"`);
      }
      if (/^[\d]+-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2}.\d{3}Z$/.test(v)) {
        walker.replace(s, s + v.length, `"${DT_TAG}${v}"`);
      }
    },
  }).run();

  const stack: Array<{ o: any; k: string; v: Value }> = [];
  const data = JSON.parse(walker.apply(), function (this: any, key: string, value: any) {
    if (__IS_DEV__) {
      u.has(key) && console.log('正在解析', key);
    }

    if (stack.length > 0) {
      const last = stack[stack.length - 1];
      if (last?.o === this && last.k === key) {
        stack.pop();
        last.v.value = reviver.call(this, key, _unwrapTag(value));
        return last.v;
      }
    }

    const v = u.get(key);
    if (!v) {
      return reviver.call(this, key, _unwrapTag(value));
    }

    // & value of the uname key is the original key
    stack.push({ o: this, k: value, v });
    return undefined;
  });

  u.clear();

  return data;
}
