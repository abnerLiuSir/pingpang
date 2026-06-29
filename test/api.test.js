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
    const winnerAvatarUrl = 'data:image/svg+xml;base64,d2lubmVy';
    const loserAvatarUrl = 'data:image/svg+xml;base64,bG9zZXI=';

    await request(app, 'PATCH', `/api/players/${winner.id}`, {
      avatarUrl: winnerAvatarUrl,
    }, token);
    await request(app, 'PATCH', `/api/players/${loser.id}`, {
      avatarUrl: loserAvatarUrl,
    }, token);

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
      score: '4:3',
      playedAt: '2026-06-26',
      note: '午休赛',
    }, token);

    assert.equal(created.status, 201);
    assert.equal(created.data.match.winnerDelta, 17);
    assert.equal(created.data.match.loserDelta, -17);

    const leaderboard = await request(app, 'GET', '/api/leaderboard');
    assert.equal(leaderboard.data.longTerm[0].id, winner.id);
    assert.equal(leaderboard.data.longTerm[0].rating, 1517);
    assert.equal(leaderboard.data.monthly[0].id, winner.id);
    assert.equal(leaderboard.data.monthly[0].ratingDelta, 17);
    assert.equal(leaderboard.data.recentMatches[0].score, '4:3');
    assert.equal(leaderboard.data.recentMatches[0].winnerAvatarUrl, winnerAvatarUrl);
    assert.equal(leaderboard.data.recentMatches[0].loserAvatarUrl, loserAvatarUrl);
  });

  it('returns only the five most recent matches on the public leaderboard', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;
    const players = await request(app, 'GET', '/api/players', undefined, token);
    const winner = players.data.players[0];
    const loser = players.data.players[1];

    for (let index = 0; index < 6; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: winner.id,
        loserId: loser.id,
        score: '3:1',
        playedAt: `2026-06-${String(index + 10).padStart(2, '0')}`,
        note: `recent-limit-${index}`,
      }, token);
    }

    const leaderboard = await request(app, 'GET', '/api/leaderboard');

    assert.equal(leaderboard.status, 200);
    assert.equal(leaderboard.data.recentMatches.length, 5);
    assert.deepEqual(
      leaderboard.data.recentMatches.map((match) => match.note),
      ['recent-limit-5', 'recent-limit-4', 'recent-limit-3', 'recent-limit-2', 'recent-limit-1'],
    );
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

  it('creates, renames, disables, and restores players', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;
    const avatarUrl = 'data:image/svg+xml;base64,PHN2Zy8+';

    const created = await request(app, 'POST', '/api/players', {
      name: 'Test Player Alpha',
      avatarUrl,
    }, token);
    assert.equal(created.status, 201);
    assert.equal(created.data.player.name, 'Test Player Alpha');
    assert.equal(created.data.player.avatarUrl, avatarUrl);
    assert.equal(created.data.player.rating, 1500);
    assert.equal(created.data.player.isActive, true);

    const renamed = await request(app, 'PATCH', `/api/players/${created.data.player.id}`, {
      name: 'Test Player Beta',
      avatarUrl: '',
      isActive: false,
    }, token);
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.player.name, 'Test Player Beta');
    assert.equal(renamed.data.player.avatarUrl, '');
    assert.equal(renamed.data.player.isActive, false);

    const activePlayers = await request(app, 'GET', '/api/players', undefined, token);
    assert.equal(activePlayers.data.players.some((player) => player.id === created.data.player.id), false);

    const allPlayers = await request(app, 'GET', '/api/admin/players', undefined, token);
    assert.equal(allPlayers.data.players.some((player) => player.id === created.data.player.id && !player.isActive), true);

    const restored = await request(app, 'PATCH', `/api/players/${created.data.player.id}`, {
      isActive: true,
    }, token);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.player.isActive, true);
  });

  it('accepts cropped avatar payloads without hitting the JSON body limit', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;
    const avatarUrl = `data:image/jpeg;base64,${'a'.repeat(180_000)}`;

    const created = await request(app, 'POST', '/api/players', {
      name: 'Large Avatar Player',
      avatarUrl,
    }, token);

    assert.equal(created.status, 201);
    assert.equal(created.data.player.avatarUrl.length, avatarUrl.length);

    const updatedAvatarUrl = `data:image/jpeg;base64,${'b'.repeat(220_000)}`;
    const updated = await request(app, 'PATCH', `/api/players/${created.data.player.id}`, {
      avatarUrl: updatedAvatarUrl,
    }, token);

    assert.equal(updated.status, 200);
    assert.equal(updated.data.player.avatarUrl.length, updatedAvatarUrl.length);
  });

  it('edits and soft-deletes matches, then recalculates ratings from match history', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const p1 = (await request(app, 'POST', '/api/players', { name: 'History One' }, token)).data.player;
    const p2 = (await request(app, 'POST', '/api/players', { name: 'History Two' }, token)).data.player;
    const p3 = (await request(app, 'POST', '/api/players', { name: 'History Three' }, token)).data.player;

    const first = await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p2.id,
      score: '3:0',
      playedAt: '2026-06-01',
    }, token);
    const second = await request(app, 'POST', '/api/matches', {
      winnerId: p2.id,
      loserId: p3.id,
      score: '3:1',
      playedAt: '2026-06-02',
    }, token);

    const edited = await request(app, 'PATCH', `/api/matches/${first.data.match.id}`, {
      winnerId: p2.id,
      loserId: p1.id,
      score: '3:2',
      playedAt: '2026-06-01',
      note: 'corrected winner',
    }, token);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.match.winnerId, p2.id);
    assert.equal(edited.data.match.score, '3:2');

    const deleted = await request(app, 'DELETE', `/api/matches/${second.data.match.id}`, undefined, token);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.match.isReverted, true);

    const leaderboard = await request(app, 'GET', '/api/leaderboard');
    const one = leaderboard.data.longTerm.find((player) => player.id === p1.id);
    const two = leaderboard.data.longTerm.find((player) => player.id === p2.id);
    const three = leaderboard.data.longTerm.find((player) => player.id === p3.id);

    assert.equal(two.rating, 1517);
    assert.equal(one.rating, 1483);
    assert.equal(three.rating, 1500);

    const matches = await request(app, 'GET', '/api/admin/matches', undefined, token);
    const deletedMatch = matches.data.matches.find((match) => match.id === second.data.match.id);
    assert.equal(deletedMatch.isReverted, true);
  });

  it('returns public player match history by scope and opponent', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const p1 = (await request(app, 'POST', '/api/players', { name: 'Public History One' }, token)).data.player;
    const p2 = (await request(app, 'POST', '/api/players', { name: 'Public History Two' }, token)).data.player;
    const p3 = (await request(app, 'POST', '/api/players', { name: 'Public History Three' }, token)).data.player;
    const p4 = (await request(app, 'POST', '/api/players', { name: 'Public History Four' }, token)).data.player;

    await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p2.id,
      score: '3:1',
      playedAt: '2026-06-01',
      note: 'monthly win',
    }, token);
    await request(app, 'POST', '/api/matches', {
      winnerId: p3.id,
      loserId: p1.id,
      score: '3:2',
      playedAt: '2026-06-02',
      note: 'monthly loss',
    }, token);
    await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p3.id,
      score: '3:0',
      playedAt: '2026-05-15',
      note: 'older win',
    }, token);
    const reverted = await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p4.id,
      score: '3:0',
      playedAt: '2026-06-03',
      note: 'deleted win',
    }, token);
    await request(app, 'DELETE', `/api/matches/${reverted.data.match.id}`, undefined, token);

    const history = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=all`);
    assert.equal(history.status, 200);
    assert.equal(history.data.player.id, p1.id);
    assert.equal(history.data.scope, 'all');
    assert.equal(history.data.summary.matches, 3);
    assert.equal(history.data.summary.wins, 2);
    assert.equal(history.data.summary.losses, 1);
    assert.equal(history.data.summary.winRate, 67);
    assert.equal(history.data.matches.some((match) => match.opponentId === p4.id), false);
    assert.equal(history.data.opponents.some((opponent) => opponent.id === p2.id), true);
    assert.equal(history.data.opponents.some((opponent) => opponent.id === p3.id), true);

    const monthly = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=month`);
    assert.equal(monthly.status, 200);
    assert.equal(monthly.data.scope, 'month');
    assert.equal(monthly.data.summary.matches, 2);
    assert.equal(monthly.data.matches.every((match) => match.playedAt.startsWith('2026-06')), true);

    const filtered = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=all&opponentId=${p3.id}`);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.summary.matches, 2);
    assert.equal(filtered.data.matches.every((match) => match.opponentId === p3.id), true);
    assert.equal(filtered.data.opponents.some((opponent) => opponent.id === p2.id), true);

    const invalidScope = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=season`);
    assert.equal(invalidScope.status, 400);

    const missingPlayer = await request(app, 'GET', '/api/players/999999/matches?scope=all');
    assert.equal(missingPlayer.status, 404);
  });

  it('allows editing historical matches for inactive players without allowing new inactive matches', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const p1 = (await request(app, 'POST', '/api/players', { name: 'Inactive History One' }, token)).data.player;
    const p2 = (await request(app, 'POST', '/api/players', { name: 'Inactive History Two' }, token)).data.player;

    const created = await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p2.id,
      score: '3:1',
      playedAt: '2026-06-03',
    }, token);
    assert.equal(created.status, 201);

    const disabled = await request(app, 'PATCH', `/api/players/${p1.id}`, { isActive: false }, token);
    assert.equal(disabled.status, 200);
    assert.equal(disabled.data.player.isActive, false);

    const edited = await request(app, 'PATCH', `/api/matches/${created.data.match.id}`, {
      winnerId: p1.id,
      loserId: p2.id,
      score: '3:2',
      playedAt: '2026-06-03',
      note: 'edited after player left',
    }, token);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.match.note, 'edited after player left');

    const newInactiveMatch = await request(app, 'POST', '/api/matches', {
      winnerId: p1.id,
      loserId: p2.id,
      score: '3:0',
      playedAt: '2026-06-04',
    }, token);
    assert.equal(newInactiveMatch.status, 400);
  });
});
