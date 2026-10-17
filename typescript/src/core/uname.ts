export type COMMENT_PREFIX = typeof COMMENT_PREFIX;
export type SEP = typeof SEP;
export const COMMENT_PREFIX = '//';
export const SEP = '\uE000';

const _f = Math.floor;
const _r = Math.random;
const r = () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/*-+^&*$#@%!~'[_f(_r() * 75)];
export const genUname = () => SEP + 'xxxxxxxxx'.replace(/[x]/g, r);
export const NaN_TAG = SEP + '/xccle*8&';
export const DT_TAG = SEP + '%Yh*Q+Sol';
