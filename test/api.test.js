import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';

async function request(app, method, url, body, token) {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return { status: response.status, data };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('api', () => {
  let tempDir;
  let db;
  let app;

  before(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'pingpang-api-'));
    db = openDatabase(path.join(tempDir, 'test.sqlite'));
    app = createApp({ db, adminPassphrase: 'score-keeper' });
  });

  after(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns seeded leaderboard data', async () => {
    const response = await request(app, 'GET', '/api/leaderboard');

    assert.equal(response.status, 200);
    assert.equal(response.data.longTerm.length >= 6, true);
    assert.equal(response.data.longTerm[0].rating, 1500);
    assert.deepEqual(response.data.monthly, []);
    assert.deepEqual(response.data.recentMatches, []);
  });

  it('rejects and accepts admin login', async () => {
    const failed = await request(app, 'POST', '/api/admin/login', { passphrase: 'wrong' });
    assert.equal(failed.status, 401);

    const succeeded = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    assert.equal(succeeded.status, 200);
    assert.equal(typeof succeeded.data.token, 'string');
  });

  it('previews and records a match with Elo changes', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const players = await request(app, 'GET', '/api/players', undefined, token);
    const winner = players.data.players[0];
    const loser = players.data.players[1];

    const preview = await request(app, 'POST', '/api/matches/preview', {
      winnerId: winner.id,
      loserId: loser.id,
    }, token);

    assert.equal(preview.status, 200);
    assert.equal(preview.data.winnerDelta, 16);
    assert.equal(preview.data.loserDelta, -16);

    const created = await request(app, 'POST', '/api/matches', {
      winnerId: winner.id,
      loserId: loser.id,
      score: '3:1',
      playedAt: '2026-06-26',
      note: '午休赛',
    }, token);

    assert.equal(created.status, 201);
    assert.equal(created.data.match.winnerDelta, 16);
    assert.equal(created.data.match.loserDelta, -16);

    const leaderboard = await request(app, 'GET', '/api/leaderboard');
    assert.equal(leaderboard.data.longTerm[0].id, winner.id);
    assert.equal(leaderboard.data.longTerm[0].rating, 1516);
    assert.equal(leaderboard.data.monthly[0].id, winner.id);
    assert.equal(leaderboard.data.monthly[0].ratingDelta, 16);
    assert.equal(leaderboard.data.recentMatches[0].score, '3:1');
  });

  it('only reverts the most recent non-reverted match', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;
    const players = await request(app, 'GET', '/api/players', undefined, token);
    const winner = players.data.players[2];
    const loser = players.data.players[3];

    const created = await request(app, 'POST', '/api/matches', {
      winnerId: winner.id,
      loserId: loser.id,
      score: '3:0',
      playedAt: '2026-06-26',
    }, token);

    const reverted = await request(app, 'POST', `/api/matches/${created.data.match.id}/revert`, undefined, token);
    assert.equal(reverted.status, 200);

    const secondRevert = await request(app, 'POST', `/api/matches/${created.data.match.id}/revert`, undefined, token);
    assert.equal(secondRevert.status, 400);
  });
});
