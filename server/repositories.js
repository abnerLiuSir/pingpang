import { calculateRatingChange } from './rating.js';

function rowToPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url || '',
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
    winnerAvatarUrl: row.winner_avatar_url || '',
    loserId: row.loser_id,
    loserName: row.loser_name,
    loserAvatarUrl: row.loser_avatar_url || '',
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

function rowToMonthlyHonor(row) {
  return {
    id: row.id,
    month: row.month,
    playerId: row.player_id,
    playerName: row.player_name,
    playerAvatarUrl: row.player_avatar_url || '',
    ratingDelta: row.rating_delta,
    wins: row.wins,
    losses: row.losses,
    matchCount: row.match_count,
    medal: row.medal,
    photoUrl: row.photo_url || '',
    settledAt: row.settled_at,
  };
}

function currentMonthPrefix(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function listPlayers(db) {
  return db
    .prepare('SELECT id, name, avatar_url, rating, is_active FROM players WHERE is_active = 1 ORDER BY name ASC')
    .all()
    .map(rowToPlayer);
}

export function listAllPlayers(db) {
  return db
    .prepare('SELECT id, name, avatar_url, rating, is_active FROM players ORDER BY is_active DESC, name ASC')
    .all()
    .map(rowToPlayer);
}

export function createPlayer(db, { name, avatarUrl = '' }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return { valid: false, message: 'Player name is required.' };
  }
  const nextAvatarUrl = normalizeAvatarUrl(avatarUrl);

  try {
    const result = db.prepare('INSERT INTO players (name, avatar_url, rating, is_active) VALUES (?, ?, 1500, 1)')
      .run(trimmedName, nextAvatarUrl);
    return { valid: true, player: getAnyPlayer(db, Number(result.lastInsertRowid)) };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return { valid: false, message: 'Player name already exists.' };
    }
    throw error;
  }
}

export function updatePlayer(db, id, { name, avatarUrl, isActive }) {
  const player = getAnyPlayer(db, id);
  if (!player) {
    return { valid: false, message: 'Player was not found.' };
  }

  const nextName = name === undefined ? player.name : String(name || '').trim();
  if (!nextName) {
    return { valid: false, message: 'Player name is required.' };
  }

  const nextActive = isActive === undefined ? player.isActive : Boolean(isActive);
  const nextAvatarUrl = avatarUrl === undefined ? player.avatarUrl : normalizeAvatarUrl(avatarUrl);

  try {
    db.prepare('UPDATE players SET name = ?, avatar_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nextName, nextAvatarUrl, nextActive ? 1 : 0, Number(id));
    return { valid: true, player: getAnyPlayer(db, id) };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return { valid: false, message: 'Player name already exists.' };
    }
    throw error;
  }
}

export function getPlayer(db, id) {
  const row = db
    .prepare('SELECT id, name, avatar_url, rating, is_active FROM players WHERE id = ? AND is_active = 1')
    .get(Number(id));
  return row ? rowToPlayer(row) : null;
}

export function getPublicPlayer(db, id) {
  return getAnyPlayer(db, id);
}

function getAnyPlayer(db, id) {
  const row = db
    .prepare('SELECT id, name, avatar_url, rating, is_active FROM players WHERE id = ?')
    .get(Number(id));
  return row ? rowToPlayer(row) : null;
}

export function previewMatch(db, { winnerId, loserId, includeInactive = false }) {
  const findPlayer = includeInactive ? getAnyPlayer : getPlayer;
  const winner = findPlayer(db, winnerId);
  const loser = findPlayer(db, loserId);

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

    recalculateRatings(db);
    return getMatch(db, Number(result.lastInsertRowid));
  });

  return { valid: true, match };
}

export function updateMatch(db, id, { winnerId, loserId, score, playedAt, note = '' }) {
  const existing = getMatch(db, id);
  if (!existing || existing.isReverted) {
    return { valid: false, message: 'Match was not found.' };
  }

  const preview = previewMatch(db, { winnerId, loserId, includeInactive: true });
  if (!preview.valid) {
    return preview;
  }

  const match = runInTransaction(db, () => {
    db.prepare(`
      UPDATE matches
      SET played_at = ?,
          winner_id = ?,
          loser_id = ?,
          score = ?,
          note = ?
      WHERE id = ?
    `).run(playedAt, Number(winnerId), Number(loserId), score, note || '', Number(id));
    recalculateRatings(db);
    return getMatch(db, id);
  });

  return { valid: true, match };
}

export function softDeleteMatch(db, id) {
  const existing = getMatch(db, id);
  if (!existing || existing.isReverted) {
    return { valid: false, message: 'Match was not found.' };
  }

  const match = runInTransaction(db, () => {
    db.prepare('UPDATE matches SET is_reverted = 1, reverted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(Number(id));
    recalculateRatings(db);
    return getMatch(db, id);
  });

  return { valid: true, match };
}

export function getMatch(db, id) {
  const row = db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      winner.avatar_url AS winner_avatar_url,
      loser.name AS loser_name,
      loser.avatar_url AS loser_avatar_url
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.id = ?
  `).get(Number(id));

  return row ? rowToMatch(row) : null;
}

export function listRecentMatches(db, limit = 5) {
  return db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      winner.avatar_url AS winner_avatar_url,
      loser.name AS loser_name,
      loser.avatar_url AS loser_avatar_url
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.is_reverted = 0
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ?
  `).all(limit).map(rowToMatch);
}

export function listAllMatches(db, limit = 100) {
  return db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      winner.avatar_url AS winner_avatar_url,
      loser.name AS loser_name,
      loser.avatar_url AS loser_avatar_url
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
    LIMIT ?
  `).all(limit).map(rowToMatch);
}

export function getMostRecentActiveMatch(db) {
  const row = db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      winner.avatar_url AS winner_avatar_url,
      loser.name AS loser_name,
      loser.avatar_url AS loser_avatar_url
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
    db.prepare('UPDATE matches SET is_reverted = 1, reverted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(match.id);
    recalculateRatings(db);
    return getMatch(db, match.id);
  });

  return { valid: true, match: reverted };
}

export function settleMonthlyHonors(db, now = new Date()) {
  const currentMonth = currentMonthPrefix(now);
  const months = db.prepare(`
    SELECT DISTINCT substr(played_at, 1, 7) AS month
    FROM matches
    WHERE is_reverted = 0
      AND substr(played_at, 1, 7) < ?
    ORDER BY month ASC
  `).all(currentMonth);

  const insertHonor = db.prepare(`
    INSERT OR IGNORE INTO monthly_honors (
      month,
      player_id,
      rating_delta,
      wins,
      losses,
      match_count,
      medal
    ) VALUES (?, ?, ?, ?, ?, ?, 'gold')
  `);

  for (const { month } of months) {
    const champion = listMonthlyLeaderboard(db, month)[0];
    if (!champion) continue;

    insertHonor.run(
      month,
      champion.id,
      champion.ratingDelta,
      champion.wins,
      champion.losses,
      champion.wins + champion.losses,
    );
  }
}

export function listMonthlyHonors(db, now = new Date()) {
  settleMonthlyHonors(db, now);
  return db.prepare(`
    SELECT
      h.*,
      p.name AS player_name,
      p.avatar_url AS player_avatar_url
    FROM monthly_honors h
    JOIN players p ON p.id = h.player_id
    ORDER BY h.month DESC
  `).all().map(rowToMonthlyHonor);
}

export function getLeaderboard(db, now = new Date()) {
  const longTerm = listLongTermLeaderboard(db);
  const monthPrefix = currentMonthPrefix(now);
  const monthly = listMonthlyLeaderboard(db, monthPrefix);
  const monthlyHonors = listMonthlyHonors(db, now);
  const recentMatches = listRecentMatches(db);
  const totalMatches = db.prepare('SELECT COUNT(*) AS count FROM matches WHERE is_reverted = 0').get().count;
  const monthMatches = db
    .prepare("SELECT COUNT(*) AS count FROM matches WHERE is_reverted = 0 AND substr(played_at, 1, 7) = ?")
    .get(monthPrefix).count;

  return {
    longTerm,
    monthly,
    monthlyHonors,
    recentMatches,
    summary: {
      totalPlayers: longTerm.length,
      totalMatches,
      monthMatches,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getPlayerMatchHistory(db, playerId, { scope = 'all', opponentId } = {}, now = new Date()) {
  const player = getPublicPlayer(db, playerId);
  if (!player) {
    return { valid: false, message: 'Player was not found.' };
  }

  const scopedMatches = listPlayerHistoryMatches(db, player.id, scope, now).map((match) => shapePlayerHistoryMatch(match, player.id));
  const filteredMatches = opponentId
    ? scopedMatches.filter((match) => match.opponentId === Number(opponentId))
    : scopedMatches;
  const wins = filteredMatches.filter((match) => match.result === 'W').length;
  const losses = filteredMatches.length - wins;
  const ratingDelta = filteredMatches.reduce((total, match) => total + match.ratingDelta, 0);
  const opponents = Array.from(
    scopedMatches.reduce((map, match) => {
      if (!map.has(match.opponentId)) {
        map.set(match.opponentId, {
          id: match.opponentId,
          name: match.opponentName,
          avatarUrl: match.opponentAvatarUrl,
        });
      }
      return map;
    }, new Map()).values(),
  ).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));

  return {
    valid: true,
    player: {
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      rating: player.rating,
    },
    scope,
    summary: {
      wins,
      losses,
      winRate: filteredMatches.length ? Math.round((wins / filteredMatches.length) * 100) : 0,
      ratingDelta,
      matches: filteredMatches.length,
    },
    opponents,
    matches: filteredMatches,
  };
}

function listPlayerHistoryMatches(db, playerId, scope, now) {
  const monthPrefix = currentMonthPrefix(now);
  const monthFilter = scope === 'month' ? 'AND substr(m.played_at, 1, 7) = ?' : '';
  const params = scope === 'month' ? [playerId, playerId, monthPrefix] : [playerId, playerId];

  return db.prepare(`
    SELECT
      m.*,
      winner.name AS winner_name,
      winner.avatar_url AS winner_avatar_url,
      loser.name AS loser_name,
      loser.avatar_url AS loser_avatar_url
    FROM matches m
    JOIN players winner ON winner.id = m.winner_id
    JOIN players loser ON loser.id = m.loser_id
    WHERE m.is_reverted = 0
      AND (m.winner_id = ? OR m.loser_id = ?)
      ${monthFilter}
    ORDER BY m.played_at DESC, m.created_at DESC, m.id DESC
  `).all(...params).map(rowToMatch);
}

function shapePlayerHistoryMatch(match, playerId) {
  const won = match.winnerId === Number(playerId);
  return {
    id: match.id,
    playedAt: match.playedAt,
    opponentId: won ? match.loserId : match.winnerId,
    opponentName: won ? match.loserName : match.winnerName,
    opponentAvatarUrl: won ? match.loserAvatarUrl : match.winnerAvatarUrl,
    result: won ? 'W' : 'L',
    score: match.score,
    ratingDelta: won ? match.winnerDelta : match.loserDelta,
    playerRatingBefore: won ? match.winnerRatingBefore : match.loserRatingBefore,
    playerRatingAfter: won ? match.winnerRatingAfter : match.loserRatingAfter,
    note: match.note,
  };
}

function listLongTermLeaderboard(db) {
  const players = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.avatar_url,
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
      avatarUrl: player.avatar_url || '',
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
      p.avatar_url,
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
      avatarUrl: player.avatar_url || '',
      rating: player.rating,
      wins,
      losses,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      ratingDelta: player.rating_delta || 0,
    };
  });
}

function normalizeAvatarUrl(value) {
  return String(value || '').trim();
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

function recalculateRatings(db) {
  const players = db.prepare('SELECT id FROM players').all();
  const ratings = new Map(players.map((player) => [player.id, 1500]));
  const matches = db.prepare(`
    SELECT id, winner_id, loser_id, score
    FROM matches
    WHERE is_reverted = 0
    ORDER BY played_at ASC, id ASC
  `).all();

  for (const match of matches) {
    const winnerRating = ratings.get(match.winner_id) ?? 1500;
    const loserRating = ratings.get(match.loser_id) ?? 1500;
    const change = calculateRatingChange({
      winnerRating,
      loserRating,
      score: match.score,
    });

    db.prepare(`
      UPDATE matches
      SET winner_rating_before = ?,
          loser_rating_before = ?,
          winner_rating_after = ?,
          loser_rating_after = ?,
          winner_delta = ?,
          loser_delta = ?
      WHERE id = ?
    `).run(
      winnerRating,
      loserRating,
      change.winnerRatingAfter,
      change.loserRatingAfter,
      change.winnerDelta,
      change.loserDelta,
      match.id,
    );

    ratings.set(match.winner_id, change.winnerRatingAfter);
    ratings.set(match.loser_id, change.loserRatingAfter);
  }

  const updatePlayerRating = db.prepare('UPDATE players SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  for (const player of players) {
    updatePlayerRating.run(ratings.get(player.id) ?? 1500, player.id);
  }
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
