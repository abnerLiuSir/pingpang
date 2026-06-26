const DEFAULT_K = 32;

export function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function calculateRatingChange({ winnerRating, loserRating, k = DEFAULT_K }) {
  const winnerExpected = calculateExpectedScore(winnerRating, loserRating);
  const winnerDelta = Math.round(k * (1 - winnerExpected));
  const loserDelta = -winnerDelta;

  return {
    winnerDelta,
    loserDelta,
    winnerRatingAfter: winnerRating + winnerDelta,
    loserRatingAfter: loserRating + loserDelta,
  };
}
