import { Walker, Side, WalkerHandlerArgsWithSides } from './walker.class.js';

const enum WalkState {
  Idle,
  Start,
  Searching,
  Found,
}

let interpretNameChars: string[] = [];
let interpretNameState: WalkState = WalkState.Idle;

const interpretNameWalker = new Walker('', {
  start: 1,
  inString: true,
  onStringContent: ({ c }) => interpretNameChars.push(c),
  onQuote({ side }) {
    if (side === Side.Right) {
      interpretNameState = WalkState.Start;
    }
  },
  afterChar({ c, t }, stop) {
    switch (interpretNameState) {
      case WalkState.Idle:
        break;
      case WalkState.Start:
        interpretNameState = WalkState.Searching;
        break;
      case WalkState.Searching:
        if (c === ':') {
          interpretNameState = WalkState.Found;
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

  interpretNameWalker.reset({ text: line, start: 1, inString: true }).run();

  if (interpretNameState !== WalkState.Found) {
    throw new Error(`Cannot find ending quote: ${line}`);
  }

  const result = interpretNameChars.join('');

  // Reset for next use
  interpretNameChars = [];
  interpretNameState = WalkState.Idle;

  return result;
}

let lastCommaIndex = -1;
let stripTrailingCommasChars: (string | null)[] = [];
let stripTrailingCommasState: WalkState = WalkState.Idle;
const onBrace = ({ side }: WalkerHandlerArgsWithSides) => {
  if (side === Side.Right && stripTrailingCommasState === WalkState.Searching) {
    stripTrailingCommasState = WalkState.Found;
  }
};

const stripTrailingCommasWalker = new Walker('', {
  onComma({ i }) {
    stripTrailingCommasState = WalkState.Start;
    lastCommaIndex = i;
  },
  onBrace,
  onBracket: onBrace,
  afterChar({ c }) {
    switch (stripTrailingCommasState) {
      case WalkState.Idle:
        break;
      case WalkState.Start:
        stripTrailingCommasState = WalkState.Searching;
        break;
      case WalkState.Searching:
        if (c.trim() !== '') {
          stripTrailingCommasState = WalkState.Idle;
        }
        break;
      case WalkState.Found:
        stripTrailingCommasState = WalkState.Idle;
        stripTrailingCommasChars[lastCommaIndex] = null;
        break;
    }
  },
});

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

  let state: WalkState = WalkState.Idle;

  stripTrailingCommasWalker.reset({ text }).run();

  return chars.filter((c) => c !== null).join('');
}
