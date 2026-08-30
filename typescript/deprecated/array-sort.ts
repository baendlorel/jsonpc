import { _exchange } from '../src/core/common.js';

const defaultCompare = function (a: any, b: any) {
  a = String(a);
  b = String(b);

  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  } else {
    return 0;
  }
};

function swap(arr: any[], i: number, j: number, commentsMap: any, path: string[]) {
  if (i === j) {
    return;
  }
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
  _exchange(commentsMap, [...path, i], [...path, j]);
}

export function quickSort(
  arr: any[],
  left: number,
  right: number,
  commentsMap: any,
  path: string[],
  compare: (a: any, b: any) => number = defaultCompare,
) {
  if (left >= right) {
    return;
  }

  // Choose middle element as pivot to avoid worst-case on already-sorted arrays
  const mid = left + Math.floor((right - left) / 2);
  swap(arr, mid, right, commentsMap, path);

  const pivot = arr[right];
  let i = left;

  for (let j = left; j < right; j++) {
    if (compare(arr[j], pivot) < 0) {
      swap(arr, i, j, commentsMap, path);
      i++;
    }
  }

  swap(arr, i, right, commentsMap, path);

  quickSort(arr, left, i - 1, commentsMap, path, compare);
  quickSort(arr, i + 1, right, commentsMap, path, compare);
}
