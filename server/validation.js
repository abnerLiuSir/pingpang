const ALLOWED_SCORES = new Set(['3:0', '3:1', '3:2']);

export function validateScore(score) {
  if (!ALLOWED_SCORES.has(String(score || '').trim())) {
    return { valid: false, message: 'Score must be 3:0, 3:1, or 3:2.' };
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
