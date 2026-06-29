import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateRatingChange, calculateScoreMultiplier } from '../server/rating.js';

describe('calculateRatingChange', () => {
  it('splits equal-rated players by 16 points at K 32', () => {
    const result = calculateRatingChange({ winnerRating: 1500, loserRating: 1500 });

    assert.deepEqual(result, {
      winnerDelta: 16,
      loserDelta: -16,
      winnerRatingAfter: 1516,
      loserRatingAfter: 1484,
    });
  });

  it('awards fewer points when a higher-rated player beats a lower-rated player', () => {
    const result = calculateRatingChange({ winnerRating: 1700, loserRating: 1500 });

    assert.equal(result.winnerDelta, 8);
    assert.equal(result.loserDelta, -8);
    assert.equal(result.winnerRatingAfter, 1708);
    assert.equal(result.loserRatingAfter, 1492);
  });

  it('awards more points when a lower-rated player beats a higher-rated player', () => {
    const result = calculateRatingChange({ winnerRating: 1500, loserRating: 1700 });

    assert.equal(result.winnerDelta, 24);
    assert.equal(result.loserDelta, -24);
    assert.equal(result.winnerRatingAfter, 1524);
    assert.equal(result.loserRatingAfter, 1676);
  });

  it('applies a small score multiplier when a score is supplied', () => {
    const sweep = calculateRatingChange({ winnerRating: 1500, loserRating: 1500, score: '3:0' });
    const close = calculateRatingChange({ winnerRating: 1500, loserRating: 1500, score: '3:2' });
    const longSweep = calculateRatingChange({ winnerRating: 1500, loserRating: 1500, score: '11:0' });

    assert.equal(calculateScoreMultiplier('4:3') > 1, true);
    assert.equal(sweep.winnerDelta > close.winnerDelta, true);
    assert.equal(longSweep.winnerDelta, 18);
  });
});
