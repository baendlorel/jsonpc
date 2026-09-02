import { createWorker } from './walker.class.js';

let lastChar: string | null = null;

const walker = createWorker({
  onOther({ c }, stop) {
    if (lastChar === '/' && c === '*') {
      stop();
      throw new Error('Block comment is not allowed');
    } else {
      lastChar = c;
    }
  },
  onInString() {
    lastChar = null;
  },
});

export function noBlockComment(text: string) {
  lastChar = null;
  walker.reset({ text }).run();
}
