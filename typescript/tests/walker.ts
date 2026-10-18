import { MiniWalker } from '../src/walkers/mini-walker.js';
import { stripTrailingCommas } from '../src/walkers/trailing-comma.js';

const text = `

// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    "x": 561
  },
  "arr":[NaN,false,null,true,2,{"a":"asdf"}],
}

// Bottom comment`;

const walker = new MiniWalker({
  text,
  onValue: ({ i, c, t, s, v, stop, w }) => {
    // console.log(v);
  },
  onArrayItem: ({ i, c, t, s, v, stop, w }) => {
    console.log(v);
  },
}).run();

const t = walker
  .apply()
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('');

const rawJSON = stripTrailingCommas(t);

console.log(rawJSON, JSON.parse(rawJSON));
