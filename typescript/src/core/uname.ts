const C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/*-+^&*$#@%!~';
const _f = Math.floor;
const _r = Math.random;
const r = () => C[_f(_r() * 75)];
export const genUname = (origin: string) => origin + SEP + 'xxxxxxxxx'.replace(/[x]/g, r);

/**
 * ! Use this after checking whether it's a uname or not.
 */
export const stripUname = (uname: string) => uname.slice(0, uname.length - 10);
