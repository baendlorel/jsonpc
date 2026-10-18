import { MiniWalker } from '../src/walkers/mini-walker.js';

const text = `

// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    "x": 561
  },
  "arr":[NaN,false,null,true,2],
}

// Bottom comment`;

const walker = new MiniWalker({
  text,
  onValue: ({ i, c, t, s, v, stop, w }) => {
    console.log(v);
    if (v === 'NaN') {
      w.replace(s, s + v.length, 'NAN标记');
    }
  },
}).run();

const t = walker.apply();

console.log(t, JSON.parse(t));
