const DEFAULT_K = 32;

export function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function calculateRatingChange({ winnerRating, loserRating, k = DEFAULT_K, score }) {
  const winnerExpected = calculateExpectedScore(winnerRating, loserRating);
  const scoreMultiplier = calculateScoreMultiplier(score);
  const winnerDelta = Math.max(1, Math.round(k * scoreMultiplier * (1 - winnerExpected)));
  const loserDelta = -winnerDelta;

  return {
    winnerDelta,
    loserDelta,
    winnerRatingAfter: winnerRating + winnerDelta,
    loserRatingAfter: loserRating + loserDelta,
  };
}

export function calculateScoreMultiplier(score) {
  const match = String(score || '').trim().match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return 1;

  const winnerGames = Number(match[1]);
  const loserGames = Number(match[2]);
  const totalGames = winnerGames + loserGames;
  if (!totalGames || winnerGames <= loserGames) return 1;

  const dominance = (winnerGames - loserGames) / totalGames;
  return clamp(1 + dominance * 0.3, 0.85, 1.15);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
