import { WalkState, WalkerHandlerArgsWithSides, Side, Walker } from '../core/walker.class.js';

let lastCommaIndex = -1;
let chars: (string | null)[] = [];
let state: WalkState = WalkState.Idle;

const onBrace = ({ side }: WalkerHandlerArgsWithSides) => {
  if (side === Side.Right && state === WalkState.Searching) {
    state = WalkState.Found;
  }
};

const stripTrailingCommasWalker = new Walker('', {
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
    chars.push(c);
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
  chars = [];
  state = WalkState.Idle;
  lastCommaIndex = -1;

  stripTrailingCommasWalker.reset({ text }).run();
  const result = chars.filter((c) => c !== null).join('');
  return result;
}
