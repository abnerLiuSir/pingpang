import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateScore, validateMatchInput } from '../server/validation.js';

describe('validateScore', () => {
  it('accepts standard best-of-five winner scores', () => {
    assert.equal(validateScore('3:0').valid, true);
    assert.equal(validateScore('3:1').valid, true);
    assert.equal(validateScore('3:2').valid, true);
  });

  it('rejects malformed or losing scores', () => {
    assert.equal(validateScore('2:3').valid, false);
    assert.equal(validateScore('3-1').valid, false);
    assert.equal(validateScore('4:0').valid, false);
  });
});

describe('validateMatchInput', () => {
  it('rejects missing players, duplicate players, missing date, and invalid score', () => {
    assert.match(validateMatchInput({ winnerId: '', loserId: '2', score: '3:1', playedAt: '2026-06-26' }).message, /winner/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '1', score: '3:1', playedAt: '2026-06-26' }).message, /different/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '2', score: '3:1', playedAt: '' }).message, /date/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '2', score: '2:3', playedAt: '2026-06-26' }).message, /score/i);
  });

  it('accepts a complete singles match input', () => {
    assert.deepEqual(
      validateMatchInput({ winnerId: '1', loserId: '2', score: '3:2', playedAt: '2026-06-26' }),
      { valid: true },
    );
  });
});
