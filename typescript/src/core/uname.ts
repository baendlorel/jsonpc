import { Value } from './value.js';

const C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/*-+^&*$#@%!~';
const _f = Math.floor;
const _r = Math.random;
const r = () => C[_f(_r() * 75)];
export const genUname = (origin: string) => origin + SEP + 'xxxxxxxxx'.replace(/[x]/g, r);
