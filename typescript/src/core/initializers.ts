import { _isArray, _keys, _notComment, _stringify, _stripPrefix } from './common.js';
import { _set, _get, _delete, type CommentMap, _setComment, _deleteComment } from './path-map.js';
import { genUname } from './uname.js';

import { interpretName } from '../walkers/interpret-name.js';

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
  // Maps unique name to the original name
  const unames = new Map<string, string>();
  const lines = aggregated.map((v, i) => {
    // Return if it's a normal line
    if (typeof v === 'string') {
      return v;
    }

    const origin = interpretName(aggregated[i + 1] as string);
    const uname = genUname(origin);
    unames.set(uname, origin);
    return `"${uname}":${_stringify(v)},`;
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
export function visit(o: any, unames: Map<string, string>, path: string[] = [], comments: CommentMap = new Map()) {
  for (const k in o) {
    const origin = unames.get(k);
    const v = o[k];
    // & If the key is a uuid name, we will use the original name
    // & to map to the value.
    if (origin) {
      // Store the comments outside the object.
      delete o[k];
      const nextPath = path.concat(origin);
      _setComment(comments, nextPath, v);
      if (typeof v === 'object') {
        visit(v, unames, nextPath, comments);
      }
    } else if (_isArray(v)) {
      const arr: any[] = [];
      const nextPath = path.concat(k);
      _setComment(comments, nextPath, arr);
      for (let i = 0; i < v.length; i++) {
        visit(v[i], unames, nextPath.concat(String(i)), comments);
      }
      // & Prevent empty array from being stored in comments.
      if (arr.length === 0) {
        _deleteComment(comments, nextPath);
      }
    } else if (typeof v === 'object') {
      visit(v, unames, path.concat(k), comments);
    } else {
      // primitives, do nothing
    }
  }
  return comments;
}
