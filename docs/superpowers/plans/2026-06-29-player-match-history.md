# Player Match History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public player match-history page reachable from leaderboard entries, with all-time/monthly scopes and opponent filtering.

**Architecture:** Keep the existing lightweight routing in `src/App.jsx` and add a public API in Express. The repository layer owns SQL aggregation and match-history shaping; the route layer validates query parameters and returns HTTP status codes; the React page renders scoped summaries and delegates filtering to the API.

**Tech Stack:** React 18, Vite, Express, SQLite via `node:sqlite`, Node test runner.

---

## File Structure

- Modify `server/repositories.js`: add a public player lookup and `getPlayerMatchHistory(db, playerId, options, now)` query helper.
- Modify `server/routes.js`: add `GET /api/players/:id/matches`.
- Modify `test/api.test.js`: add API tests for all-time history, monthly scope, opponent filter, reverted exclusion, invalid player, and invalid scope.
- Modify `src/App.jsx`: add simple player route detection, clickable leaderboard entries, `PlayerHistoryPage`, and match-history UI helpers.
- Modify `src/styles.css`: style clickable ranking rows and the player-history page.

## Task 1: Backend Match-History API

**Files:**
- Modify: `server/repositories.js`
- Modify: `server/routes.js`
- Test: `test/api.test.js`

- [ ] **Step 1: Write failing API tests**

Add tests that create players and matches, then assert:

```js
const history = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=all`);
assert.equal(history.status, 200);
assert.equal(history.data.summary.matches, 3);
assert.equal(history.data.summary.wins, 2);
assert.equal(history.data.summary.losses, 1);
assert.equal(history.data.matches[0].opponentId, p2.id);
assert.equal(history.data.matches[0].result, 'L');

const monthly = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=month`);
assert.equal(monthly.status, 200);
assert.equal(monthly.data.scope, 'month');
assert.equal(monthly.data.summary.matches, 2);

const filtered = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=all&opponentId=${p3.id}`);
assert.equal(filtered.status, 200);
assert.equal(filtered.data.matches.every((match) => match.opponentId === p3.id), true);

const invalidScope = await request(app, 'GET', `/api/players/${p1.id}/matches?scope=season`);
assert.equal(invalidScope.status, 400);

const missingPlayer = await request(app, 'GET', '/api/players/999999/matches?scope=all');
assert.equal(missingPlayer.status, 404);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test`

Expected: the new tests fail because `/api/players/:id/matches` is not registered.

- [ ] **Step 3: Implement repository helper**

Add an exported `getPublicPlayer(db, id)` that reads any player by ID, and `getPlayerMatchHistory(db, playerId, { scope, opponentId }, now = new Date())` that:

- validates the player exists;
- filters non-reverted matches by player;
- applies `substr(played_at, 1, 7)` for `scope === 'month'`;
- derives per-match result, opponent, rating delta, player rating before/after;
- derives summary wins, losses, win rate, rating delta, and match count;
- derives opponents from the unfiltered scoped matches.

- [ ] **Step 4: Implement route**

Add `router.get('/players/:id/matches', ...)` before admin-only player routes. Validate `scope` as `all` or `month`, parse optional `opponentId`, return `400` for invalid scope, `404` for unknown player, and JSON for valid history.

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm test`

Expected: all API and existing tests pass.

## Task 2: Frontend Route And Navigation

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add route detection**

Extend `App` so `/players/:id` renders `PlayerHistoryPage` while `/admin-score-entry` still renders `AdminPage`.

- [ ] **Step 2: Add leaderboard links**

Update `PodiumPlayer` and `LeaderboardTable` so each visible player links to `playerHistoryHref(player.id, mode)`, where long-term mode maps to `scope=all` and monthly mode maps to `scope=month`.

- [ ] **Step 3: Preserve current homepage behavior**

Keep search, top-three slicing, monthly/long-term mode, and empty states unchanged except for adding navigation links.

## Task 3: Player History Page UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add page state and data loading**

Implement `PlayerHistoryPage({ playerId })` with `scope`, `opponentId`, `data`, `status`, and `error` state. Load `/api/players/:id/matches?scope=<scope>&opponentId=<id>` whenever scope or opponent changes.

- [ ] **Step 2: Render summary and filters**

Render avatar, name, current rating, wins/losses/win rate/rating delta, a two-button segmented control for scope, and an opponent select with "全部对手".

- [ ] **Step 3: Render match list**

Render date, opponent badge, result, score, rating delta, rating before/after, and note. Use existing `PlayerAvatar`, `Delta`, `EmptyState`, `ErrorState`, and date formatting where possible.

- [ ] **Step 4: Add responsive styles**

Add `.history-*` styles using the existing neutral product UI language. Keep row dimensions stable and readable on mobile.

## Task 4: Verification

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Run full automated checks**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Build frontend**

Run: `pnpm build`

Expected: Vite build completes without errors.

- [ ] **Step 3: Start local dev server**

Run: `pnpm dev`

Expected: app is available at the printed local URL, with the new history page reachable from leaderboard player clicks.

## Self-Review

- Spec coverage: the plan covers public route, homepage navigation, scope-aware API, opponent filtering, empty/error states, and tests.
- Placeholder scan: no placeholder tasks are left.
- Type consistency: route, query names, response fields, and UI state names match the design document.
