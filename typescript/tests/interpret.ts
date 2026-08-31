import { JSONPC } from '../src/index.js';

const text = `

// Top comment 1
// Top comment 2

{
  // Comment for ddd
  "ddd": 23,
  "nested": {
    "x": 561
  }
}

// Bottom comment`;

const jpc = new JSONPC(text);
jpc.set('ddd', { value: [2], comments: ['Updated comment'] });
console.log(jpc.toObject());
console.log(jpc.stringify());
