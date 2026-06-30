import crypto from 'node:crypto';
import express from 'express';
import {
  createPlayer,
  createMatch,
  getLeaderboard,
  getPlayerMatchHistory,
  listMonthlyHonors,
  listAllMatches,
  listAllPlayers,
  listPlayers,
  previewMatch,
  revertMostRecentMatch,
  softDeleteMatch,
  updateMatch,
  updateMonthlyHonor,
  updatePlayer,
} from './repositories.js';
import { validateMatchInput } from './validation.js';

export function createRouter({ db, adminPassphrase }) {
  const router = express.Router();
  const sessions = new Set();

  function requireAdmin(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');

    if (!token || !sessions.has(token)) {
      res.status(401).json({ message: 'Admin access is required.' });
      return;
    }

    next();
  }

  router.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  router.get('/leaderboard', (req, res) => {
    res.json(getLeaderboard(db));
  });

  router.get('/players/:id/matches', (req, res) => {
    const scope = req.query?.scope || 'all';
    if (!['all', 'month'].includes(scope)) {
      res.status(400).json({ message: 'Scope must be all or month.' });
      return;
    }

    const opponentId = req.query?.opponentId ? Number(req.query.opponentId) : undefined;
    if (req.query?.opponentId && !Number.isInteger(opponentId)) {
      res.status(400).json({ message: 'Opponent id must be a number.' });
      return;
    }

    const result = getPlayerMatchHistory(db, req.params.id, { scope, opponentId });
    if (!result.valid) {
      res.status(404).json({ message: result.message });
      return;
    }

    res.json(result);
  });

  router.get('/players', requireAdmin, (req, res) => {
    res.json({ players: listPlayers(db) });
  });

  router.get('/admin/players', requireAdmin, (req, res) => {
    res.json({ players: listAllPlayers(db) });
  });

  router.get('/admin/monthly-honors', requireAdmin, (req, res) => {
    res.json({ monthlyHonors: listMonthlyHonors(db) });
  });

  router.patch('/admin/monthly-honors/:id', requireAdmin, (req, res) => {
    const result = updateMonthlyHonor(db, req.params.id, {
      photoUrl: req.body?.photoUrl,
    });

    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({ monthlyHonor: result.monthlyHonor });
  });

  router.post('/players', requireAdmin, (req, res) => {
    const result = createPlayer(db, {
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl,
    });
    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.status(201).json({ player: result.player });
  });

  router.patch('/players/:id', requireAdmin, (req, res) => {
    const result = updatePlayer(db, req.params.id, {
      name: req.body?.name,
      avatarUrl: req.body?.avatarUrl,
      isActive: req.body?.isActive,
    });
    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({ player: result.player });
  });

  router.post('/admin/login', (req, res) => {
    if (!req.body?.passphrase || req.body.passphrase !== adminPassphrase) {
      res.status(401).json({ message: 'Passphrase is incorrect.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessions.add(token);
    res.json({ token });
  });

  router.post('/matches/preview', requireAdmin, (req, res) => {
    const result = previewMatch(db, {
      winnerId: req.body?.winnerId,
      loserId: req.body?.loserId,
    });

    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({
      winner: result.winner,
      loser: result.loser,
      winnerDelta: result.winnerDelta,
      loserDelta: result.loserDelta,
      winnerRatingAfter: result.winnerRatingAfter,
      loserRatingAfter: result.loserRatingAfter,
    });
  });

  router.post('/matches', requireAdmin, (req, res) => {
    const validation = validateMatchInput(req.body || {});
    if (!validation.valid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const result = createMatch(db, {
      winnerId: req.body.winnerId,
      loserId: req.body.loserId,
      score: req.body.score,
      playedAt: req.body.playedAt,
      note: req.body.note,
    });

    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.status(201).json({ match: result.match });
  });

  router.get('/admin/matches', requireAdmin, (req, res) => {
    res.json({ matches: listAllMatches(db) });
  });

  router.patch('/matches/:id', requireAdmin, (req, res) => {
    const validation = validateMatchInput(req.body || {});
    if (!validation.valid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const result = updateMatch(db, req.params.id, {
      winnerId: req.body.winnerId,
      loserId: req.body.loserId,
      score: req.body.score,
      playedAt: req.body.playedAt,
      note: req.body.note,
    });

    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({ match: result.match });
  });

  router.delete('/matches/:id', requireAdmin, (req, res) => {
    const result = softDeleteMatch(db, req.params.id);
    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({ match: result.match });
  });

  router.post('/matches/:id/revert', requireAdmin, (req, res) => {
    const result = revertMostRecentMatch(db, req.params.id);
    if (!result.valid) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.json({ match: result.match });
  });

  return router;
}
