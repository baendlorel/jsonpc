const _f = Math.floor;
const _r = Math.random;
const r = () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/*-+^&*$#@%!~'[_f(_r() * 75)];
export const genUname = () => SEP + 'xxxxxxxxx'.replace(/[x]/g, r);
