export function validateScore(score) {
  const normalized = String(score || '').trim();
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return { valid: false, message: 'Score must use two whole numbers, like 3:1.' };
  }

  const winnerGames = Number(match[1]);
  const loserGames = Number(match[2]);
  if (winnerGames <= loserGames) {
    return { valid: false, message: 'Winner games must be greater than loser games.' };
  }

  return { valid: true };
}

export function validateMatchInput({ winnerId, loserId, score, playedAt }) {
  if (!winnerId) {
    return { valid: false, message: 'Winner is required.' };
  }

  if (!loserId) {
    return { valid: false, message: 'Loser is required.' };
  }

  if (String(winnerId) === String(loserId)) {
    return { valid: false, message: 'Winner and loser must be different players.' };
  }

  if (!playedAt) {
    return { valid: false, message: 'Match date is required.' };
  }

  const scoreResult = validateScore(score);
  if (!scoreResult.valid) {
    return scoreResult;
  }

  return { valid: true };
}
