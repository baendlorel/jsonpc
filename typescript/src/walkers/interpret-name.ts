import { WalkState, createWorker, Side } from './walker.class.js';

let chars: string[] = [];
let state: WalkState = WalkState.Idle;

const interpretNameWalker = createWorker({
  inString: true,
  onInString: ({ c }) => chars.push(c),
  onQuote({ side }) {
    if (side === Side.Right) {
      state = WalkState.Start;
    }
  },
  afterChar({ c, t }, stop) {
    switch (state) {
      case WalkState.Idle:
        break;
      case WalkState.Start:
        state = WalkState.Searching;
        break;
      case WalkState.Searching:
        if (c === ':') {
          state = WalkState.Found;
          stop();
          return;
        } else if (c.trim() !== '') {
          throw new Error(`Unexpected character after property name: ${t}`);
        }
        break;
      case WalkState.Found: // This won't happen, but just in case.
        stop();
        break;
    }
  },
});

export function interpretName(line: string) {
  if (line[0] !== '"') {
    throw new Error(`Comments are only allowed directly above property names`);
  }
  // Reset for next use
  chars = [];
  state = WalkState.Idle;

  interpretNameWalker.reset({ text: line, inString: true }).run(1);

  if ((state as WalkState) !== WalkState.Found) {
    throw new Error(`Cannot find ending quote: ${line}`);
  }

  return chars.join('');
}
