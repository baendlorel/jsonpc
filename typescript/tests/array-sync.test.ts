import { describe, expect, it } from 'vitest';
import { JSONPC } from '../src/index.js';

function makeArrJPC(arr: any[]) {
  return new JSONPC(JSON.stringify({ arr }));
}
