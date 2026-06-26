import { calculateRatingChange } from './rating.js';

function rowToPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    isActive: Boolean(row.is_active),
  };
}

function rowToMatch(row) {
  return {
    id: row.id,
    playedAt: row.played_at,
    score: row.score,
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    loserId: row.loser_id,
    loserName: row.loser_name,
    winnerRatingBefore: row.winner_rating_before,
    loserRatingBefore: row.loser_rating_before,
    winnerRatingAfter: row.winner_rating_after,
    loserRatingAfter: row.loser_rating_after,
    winnerDelta: row.winner_delta,
    loserDelta: row.loser_delta,
    note: row.note || '',
    isReverted: Boolean(row.is_reverted),
    createdAt: row.created_at,
  };
}

export function listPlayers(db) {
  return db
    .prepare('SELECT id, name, rating, is_active FROM players WHERE is_active = 1 ORDER BY name ASC')
    .all()
    .map(rowToPlayer);
}

export function getPlayer(db, id) {
  const row = db
    .prepare('SELECT id, name, rating, is_active FROM players WHERE id = ? AND is_active = 1')
    .get(Number(id));
  return row ? rowToPlayer(row) : null;
}

export function previewMatch(db, { winnerId, loserId }) {
  const winner = getPlayer(db, winnerId);
  const loser = getPlayer(db, loserId);

  if (!winner || !loser) {
    return { valid: false, message: 'Selected players were not found.' };
  }

  return {
    valid: true,
    winner,
    loser,
    ...calculateRatingChange({
      winnerRating: winner.rating,
      loserRating: loser.rating,
    }),
  };
}

export function createMatch(db, { winnerId, loserId, score, playedAt, note = '' }) {
  const preview = previewMatch(db, { winnerId, loserId });
  if (!preview.valid) {
    return preview;
  }

  const match = runInTransaction(db, () => {
    const insert = db.prepare(`
      INSERT INTO matches (
        played_at,
        winner_id,
        loser_id,
        score,
        winner_rating_before,
        loser_rating_before,
        winner_rating_after,
        loser_rating_after,
        winner_delta,
        loser_delta,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      playedAt,
      Number(winnerId),
      Number(loserId),
      score,
      preview.winner.rating,
      preview.loser.rating,
      preview.winnerRatingAfter,
      preview.loserRatingAfter,
      preview.winnerDelta,
      preview.loserDelta,
      note || '',
    );

    db.prepare('UPDATE players SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(preview.winnerRatingAfter, Number(winnerId));
    db.prepare('UPDATE players SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(preview.loserRatingAfter, Number(loserId));

    return getMatch(db, Number(result.lastInsertRowid));
  });

  return { valid: true, match };
}

export function getMatch(db, id) {
  const row = db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      loser.name AS loser_name
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.id = ?
  `).get(Number(id));

  return row ? rowToMatch(row) : null;
}

export function listRecentMatches(db, limit = 8) {
  return db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      loser.name AS loser_name
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.is_reverted = 0
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ?
  `).all(limit).map(rowToMatch);
}

export function getMostRecentActiveMatch(db) {
  const row = db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      loser.name AS loser_name
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.is_reverted = 0
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  `).get();

  return row ? rowToMatch(row) : null;
}

export function revertMostRecentMatch(db, id) {
  const match = getMatch(db, id);
  const mostRecent = getMostRecentActiveMatch(db);

  if (!match || match.isReverted || !mostRecent || mostRecent.id !== Number(id)) {
    return { valid: false, message: 'Only the most recent match can be reverted.' };
  }

  const reverted = runInTransaction(db, () => {
    db.prepare('UPDATE players SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(match.winnerRatingBefore, match.winnerId);
    db.prepare('UPDATE players SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(match.loserRatingBefore, match.loserId);
    db.prepare('UPDATE matches SET is_reverted = 1, reverted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(match.id);
    return getMatch(db, match.id);
  });

  return { valid: true, match: reverted };
}

export function getLeaderboard(db, now = new Date()) {
  const longTerm = listLongTermLeaderboard(db);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthly = listMonthlyLeaderboard(db, monthPrefix);
  const recentMatches = listRecentMatches(db);
  const totalMatches = db.prepare('SELECT COUNT(*) AS count FROM matches WHERE is_reverted = 0').get().count;
  const monthMatches = db
    .prepare("SELECT COUNT(*) AS count FROM matches WHERE is_reverted = 0 AND substr(played_at, 1, 7) = ?")
    .get(monthPrefix).count;

  return {
    longTerm,
    monthly,
    recentMatches,
    summary: {
      totalPlayers: longTerm.length,
      totalMatches,
      monthMatches,
      updatedAt: new Date().toISOString(),
    },
  };
}

function listLongTermLeaderboard(db) {
  const players = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.rating,
      SUM(CASE WHEN m.winner_id = p.id AND m.is_reverted = 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN m.loser_id = p.id AND m.is_reverted = 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(CASE
        WHEN m.winner_id = p.id AND m.is_reverted = 0 THEN m.winner_delta
        WHEN m.loser_id = p.id AND m.is_reverted = 0 THEN m.loser_delta
        ELSE 0
      END), 0) AS rating_delta
    FROM players p
    LEFT JOIN matches m ON m.winner_id = p.id OR m.loser_id = p.id
    WHERE p.is_active = 1
    GROUP BY p.id
    ORDER BY p.rating DESC, p.name ASC
  `).all();

  return players.map((player, index) => {
    const wins = player.wins || 0;
    const losses = player.losses || 0;
    const total = wins + losses;
    return {
      id: player.id,
      rank: index + 1,
      name: player.name,
      rating: player.rating,
      wins,
      losses,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      ratingDelta: player.rating_delta || 0,
      recentForm: getRecentForm(db, player.id),
    };
  });
}

function listMonthlyLeaderboard(db, monthPrefix) {
  return db.prepare(`
    SELECT
      p.id,
      p.name,
      p.rating,
      SUM(CASE WHEN m.winner_id = p.id THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN m.loser_id = p.id THEN 1 ELSE 0 END) AS losses,
      SUM(CASE
        WHEN m.winner_id = p.id THEN m.winner_delta
        WHEN m.loser_id = p.id THEN m.loser_delta
        ELSE 0
      END) AS rating_delta
    FROM players p
    JOIN matches m ON (m.winner_id = p.id OR m.loser_id = p.id)
    WHERE p.is_active = 1
      AND m.is_reverted = 0
      AND substr(m.played_at, 1, 7) = ?
    GROUP BY p.id
    ORDER BY rating_delta DESC, wins DESC, p.name ASC
  `).all(monthPrefix).map((player, index) => {
    const wins = player.wins || 0;
    const losses = player.losses || 0;
    const total = wins + losses;
    return {
      id: player.id,
      rank: index + 1,
      name: player.name,
      rating: player.rating,
      wins,
      losses,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      ratingDelta: player.rating_delta || 0,
    };
  });
}

function getRecentForm(db, playerId) {
  return db.prepare(`
    SELECT winner_id, loser_id
    FROM matches
    WHERE is_reverted = 0 AND (winner_id = ? OR loser_id = ?)
    ORDER BY created_at DESC, id DESC
    LIMIT 5
  `).all(playerId, playerId).map((row) => (row.winner_id === playerId ? 'W' : 'L'));
}

function runInTransaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
