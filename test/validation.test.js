import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateScore, validateMatchInput } from '../server/validation.js';

describe('validateScore', () => {
  it('accepts custom winner-loser game counts', () => {
    assert.equal(validateScore('3:0').valid, true);
    assert.equal(validateScore('3:1').valid, true);
    assert.equal(validateScore('3:2').valid, true);
    assert.equal(validateScore('4:3').valid, true);
    assert.equal(validateScore('7:5').valid, true);
  });

  it('rejects malformed, tied, fractional, or losing scores', () => {
    assert.equal(validateScore('2:3').valid, false);
    assert.equal(validateScore('3:3').valid, false);
    assert.equal(validateScore('3-1').valid, false);
    assert.equal(validateScore('3.5:2').valid, false);
  });
});

describe('validateMatchInput', () => {
  it('rejects missing players, duplicate players, missing date, and invalid score', () => {
    assert.match(validateMatchInput({ winnerId: '', loserId: '2', score: '3:1', playedAt: '2026-06-26' }).message, /winner/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '1', score: '3:1', playedAt: '2026-06-26' }).message, /different/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '2', score: '3:1', playedAt: '' }).message, /date/i);
    assert.match(validateMatchInput({ winnerId: '1', loserId: '2', score: '2:3', playedAt: '2026-06-26' }).message, /winner games/i);
  });

  it('accepts a complete singles match input', () => {
    assert.deepEqual(
      validateMatchInput({ winnerId: '1', loserId: '2', score: '4:3', playedAt: '2026-06-26' }),
      { valid: true },
    );
  });
});
