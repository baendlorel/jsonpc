import { Walker, Side, WalkerHandlerArgsWithSides } from './walker.class.js';

const enum WalkState {
  Idle,
  Start,
  Searching,
  Found,
}

export function interpretName(line: string) {
  if (line[0] !== '"') {
    throw new Error(`Comments are only allowed directly above property names`);
  }
  const chars: string[] = [];
  let state = WalkState.Idle;

  new Walker(line, {
    start: 1,
    inString: true,
    onStringContent: ({ c }) => chars.push(c),
    onQuote({ side }) {
      if (side === Side.Right) {
        state = WalkState.Start;
      }
    },
    afterChar({ c }, stop) {
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
            throw new Error(`Unexpected character after property name: ${line}`);
          }
          break;
        case WalkState.Found: // This won't happen, but just in case.
          stop();
          break;
      }
    },
  }).run();

  if ((state as WalkState) !== WalkState.Found) {
    throw new Error(`Cannot find ending quote: ${line}`);
  }

  return chars.join('');
}

/**
 * Scan the whole text, and remove trailing commas.
 *
 * **This function is based on the concepts below:**
 * 1. Trailing commas will only appear before `}` or `]`.
 * 2. Trailing commas will not appear in string literals.
 * 3. Comments satisfies the rules of JSONPC.
 */
export function stripTrailingCommas(text: string) {
  const chars: (string | null)[] = text.split('');

  let lastCommaIndex = -1;
  let state: WalkState = WalkState.Idle;

  const onBrace = ({ side }: WalkerHandlerArgsWithSides) => {
    if (side === Side.Right && state === WalkState.Searching) {
      state = WalkState.Found;
    }
  };

  new Walker(text, {
    onComma({ i }) {
      state = WalkState.Start;
      lastCommaIndex = i;
    },
    onBrace,
    onBracket: onBrace,
    afterChar({ c }) {
      switch (state) {
        case WalkState.Idle:
          break;
        case WalkState.Start:
          state = WalkState.Searching;
          break;
        case WalkState.Searching:
          if (c.trim() !== '') {
            state = WalkState.Idle;
          }
          break;
        case WalkState.Found:
          state = WalkState.Idle;
          chars[lastCommaIndex] = null;
          break;
      }
    },
  });

  return chars.filter((c) => c !== null).join('');
}
