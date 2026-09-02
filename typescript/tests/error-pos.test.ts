import { describe, it, expect } from 'vitest';
import { JSONPC } from '../src/index.js';

describe('Error positions', () => {
  it('Cannot on array items', () => {
    const text = `{
      "items": [
        // ❌ Invalid: Comment not above a property
        1,
        2,
      ],
    }`;
    expect(() => new JSONPC(text)).toThrow(/Comments are only allowed directly/);
  });

  it('Cannot be in weird places', () => {
    const text = `{
      "key":
        // ❌ Invalid: Wired places
      "value",
    }`;
    expect(() => new JSONPC(text)).toThrow(/Cannot find ending quote/);
  });

  it('Cannot have block comments', () => {
    const text = `{
      /* ❌ Invalid: Block comments not supported */
      "key": "value",
    }`;
    expect(() => new JSONPC(text)).toThrow(/Block comment is not allowed/);
  });

  // TEST 这里甚至影响了trailing commas的处理，因此很难精准定位到正确的报错信息
  it('Cannot have trailing comments', () => {
    const text = `{
      "key": "value",
      // ❌ Invalid: Comment not above a property
    }`;
    expect(() => new JSONPC(text)).toThrow(/Expected double-quoted property name in JSON/);
  });
});
