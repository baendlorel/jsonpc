const C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const _f = Math.floor;
const _r = Math.random;
const r = () => _f(_r() * 62);
export const genUname = (origin: string) => origin + SEP + Array(8).map(r).join('');
