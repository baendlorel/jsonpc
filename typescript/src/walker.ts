import { _noop } from './common.js';

export const isSpace = (t: unknown) => t === ' ' || t === '\t' || t === '\r' || t === '\n';

interface WalkerHandlerArgs {
  index: number;
}

interface WalkerHandlerArgsWithSides extends WalkerHandlerArgs {
  side: 'left' | 'right';
}

/**
 * Only triggred on chars that are not inside a string.
 */
interface WalkerOptions {
  start: number;
  end: number;

  onComma: (args: WalkerHandlerArgs) => void;
  onColon: (args: WalkerHandlerArgs) => void;
  onQuote: (args: WalkerHandlerArgsWithSides) => void;
  onBrace: (args: WalkerHandlerArgsWithSides) => void;
  onBracket: (args: WalkerHandlerArgsWithSides) => void;

  /**
   * Triggers when char is not something above.
   */
  onOther: (args: WalkerHandlerArgs) => void;

  /**
   * Triggers when char is not something above, and is not whitespace.
   */
  afterChar: (args: WalkerHandlerArgs) => void;
}

export function walk(text: string, handlers: Partial<WalkerOptions>) {
  const {
    start = 0,
    end = text.length - 1,
    onComma = _noop,
    onColon = _noop,
    onQuote = _noop,
    onBrace = _noop,
    onBracket = _noop,
    onOther = _noop,
    afterChar = _noop,
  } = handlers;

  let inString = false;
  let escaped = false;

  for (let i = start; i < end; i++) {
    const char = text[i];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      afterChar({ index: i });
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    // Handle characters inside strings
    if (inString) {
      if (char === '"') {
        inString = false;
        onQuote({ index: i, side: 'right' });
        afterChar({ index: i });
      }
      continue;
    }

    // Handle characters outside strings
    switch (char) {
      case ',':
        onComma({ index: i });
        break;
      case ':':
        onColon({ index: i });
        break;
      case '"':
        inString = true;
        onQuote({ index: i, side: 'left' });
        break;
      case '{':
        onBrace({ index: i, side: 'left' });
        break;
      case '}':
        onBrace({ index: i, side: 'right' });
        break;
      case '[':
        onBracket({ index: i, side: 'left' });
        break;
      case ']':
        onBracket({ index: i, side: 'right' });
        break;
      default:
        onOther({ index: i });
        break;
    }
    afterChar({ index: i });
  }
}
