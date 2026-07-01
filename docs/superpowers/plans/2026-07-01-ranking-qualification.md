# Ranking Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add official ranking qualification so low-activity players remain visible but cannot occupy official long-term or monthly leaderboard positions.

**Architecture:** Keep Elo calculation unchanged in `server/rating.js`. Add qualification metadata and qualification-aware ordering in `server/repositories.js`, then surface those fields in the existing React leaderboard rows. Monthly honor settlement should reuse the monthly leaderboard result and skip provisional rows.

**Tech Stack:** Node test runner, Express, SQLite `node:sqlite`, React, Vite.

---

## File Structure

- Modify `test/api.test.js`: add API coverage for long-term qualification, monthly qualification, and monthly honor settlement skipping provisional leaders.
- Modify `server/repositories.js`: add qualification constants, derive `matchCount`, `isQualified`, and `qualificationLabel`, and update leaderboard ordering.
- Modify `src/App.jsx`: render compact qualification labels in podium and ranking rows where leaderboard player data includes provisional status.
- Modify `src/styles.css`: add compact label styling that fits existing rank rows and podium cards.

Do not modify `server/rating.js`; K stays `32`.

## Task 1: API Tests For Long-Term Qualification

**Files:**
- Modify: `test/api.test.js`

- [ ] **Step 1: Write the failing test**

Add this test near the existing leaderboard API tests:

```js
  it('keeps low-activity players visible but below qualified long-term players', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const provisional = (await request(app, 'POST', '/api/players', { name: 'Qualification Provisional' }, token)).data.player;
    const provisionalOpponent = (await request(app, 'POST', '/api/players', { name: 'Qualification Provisional Opponent' }, token)).data.player;
    const qualified = (await request(app, 'POST', '/api/players', { name: 'Qualification Qualified' }, token)).data.player;
    const qualifiedOpponent = (await request(app, 'POST', '/api/players', { name: 'Qualification Qualified Opponent' }, token)).data.player;

    await request(app, 'POST', '/api/matches', {
      winnerId: provisional.id,
      loserId: provisionalOpponent.id,
      score: '3:0',
      playedAt: currentMonthDate(5),
    }, token);

    for (let index = 0; index < 11; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: index % 2 === 0 ? qualified.id : qualifiedOpponent.id,
        loserId: index % 2 === 0 ? qualifiedOpponent.id : qualified.id,
        score: '3:2',
        playedAt: currentMonthDate(6 + index),
      }, token);
    }

    const leaderboard = await request(app, 'GET', '/api/leaderboard');
    const provisionalRow = leaderboard.data.longTerm.find((player) => player.id === provisional.id);
    const qualifiedRow = leaderboard.data.longTerm.find((player) => player.id === qualified.id);
    const provisionalIndex = leaderboard.data.longTerm.findIndex((player) => player.id === provisional.id);
    const qualifiedIndex = leaderboard.data.longTerm.findIndex((player) => player.id === qualified.id);

    assert.equal(provisionalRow.matchCount, 1);
    assert.equal(provisionalRow.isQualified, false);
    assert.equal(provisionalRow.qualificationLabel, '定级中');
    assert.equal(qualifiedRow.matchCount, 11);
    assert.equal(qualifiedRow.isQualified, true);
    assert.equal(qualifiedRow.qualificationLabel, '');
    assert.equal(provisionalRow.rating > qualifiedRow.rating, true);
    assert.equal(qualifiedIndex < provisionalIndex, true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test
```

Expected: the new test fails because `matchCount`, `isQualified`, and `qualificationLabel` are missing, and provisional rows are not sorted below qualified rows.

## Task 2: API Tests For Monthly Qualification And Honors

**Files:**
- Modify: `test/api.test.js`

- [ ] **Step 1: Write the failing test for monthly leaderboard qualification**

Add this test near the monthly honor tests:

```js
  it('keeps monthly players with five matches provisional and qualifies them after six', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const fiveMatchPlayer = (await request(app, 'POST', '/api/players', { name: 'Monthly Five Match Player' }, token)).data.player;
    const fiveMatchOpponent = (await request(app, 'POST', '/api/players', { name: 'Monthly Five Match Opponent' }, token)).data.player;
    const sixMatchPlayer = (await request(app, 'POST', '/api/players', { name: 'Monthly Six Match Player' }, token)).data.player;
    const sixMatchOpponent = (await request(app, 'POST', '/api/players', { name: 'Monthly Six Match Opponent' }, token)).data.player;

    for (let index = 0; index < 5; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: fiveMatchPlayer.id,
        loserId: fiveMatchOpponent.id,
        score: '3:0',
        playedAt: currentMonthDate(1 + index),
      }, token);
    }

    for (let index = 0; index < 6; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: index % 2 === 0 ? sixMatchPlayer.id : sixMatchOpponent.id,
        loserId: index % 2 === 0 ? sixMatchOpponent.id : sixMatchPlayer.id,
        score: '3:2',
        playedAt: currentMonthDate(10 + index),
      }, token);
    }

    const leaderboard = await request(app, 'GET', '/api/leaderboard');
    const fiveMatchRow = leaderboard.data.monthly.find((player) => player.id === fiveMatchPlayer.id);
    const sixMatchRow = leaderboard.data.monthly.find((player) => player.id === sixMatchPlayer.id);
    const fiveMatchIndex = leaderboard.data.monthly.findIndex((player) => player.id === fiveMatchPlayer.id);
    const sixMatchIndex = leaderboard.data.monthly.findIndex((player) => player.id === sixMatchPlayer.id);

    assert.equal(fiveMatchRow.matchCount, 5);
    assert.equal(fiveMatchRow.isQualified, false);
    assert.equal(fiveMatchRow.qualificationLabel, '本月场次不足');
    assert.equal(sixMatchRow.matchCount, 6);
    assert.equal(sixMatchRow.isQualified, true);
    assert.equal(sixMatchRow.qualificationLabel, '');
    assert.equal(fiveMatchRow.ratingDelta > sixMatchRow.ratingDelta, true);
    assert.equal(sixMatchIndex < fiveMatchIndex, true);
  });
```

- [ ] **Step 2: Write the failing test for monthly honor settlement**

Add this test near the existing completed-month honor settlement test:

```js
  it('does not settle a monthly honor when the completed month has no qualified player', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const leader = (await request(app, 'POST', '/api/players', { name: 'Unqualified Honor Leader' }, token)).data.player;
    const opponent = (await request(app, 'POST', '/api/players', { name: 'Unqualified Honor Opponent' }, token)).data.player;

    for (let index = 0; index < 5; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: leader.id,
        loserId: opponent.id,
        score: '3:0',
        playedAt: `2026-02-${String(10 + index).padStart(2, '0')}`,
      }, token);
    }

    const leaderboard = await request(app, 'GET', '/api/leaderboard');

    assert.equal(leaderboard.status, 200);
    assert.equal(leaderboard.data.monthlyHonors.some((honor) => honor.month === '2026-02'), false);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test
```

Expected: the new monthly tests fail because monthly qualification fields and honor filtering do not exist.

## Task 3: Backend Qualification Logic

**Files:**
- Modify: `server/repositories.js`

- [ ] **Step 1: Add qualification constants**

Near the top of `server/repositories.js`, after the import, add:

```js
const LONG_TERM_QUALIFICATION_MATCHES = 10;
const MONTHLY_QUALIFICATION_MATCHES = 5;
const LONG_TERM_PROVISIONAL_LABEL = '定级中';
const MONTHLY_PROVISIONAL_LABEL = '本月场次不足';
```

- [ ] **Step 2: Update long-term SQL ordering and row shaping**

In `listLongTermLeaderboard`, update the SQL `ORDER BY`:

```sql
    ORDER BY
      CASE WHEN (
        SUM(CASE WHEN m.winner_id = p.id AND m.is_reverted = 0 THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m.loser_id = p.id AND m.is_reverted = 0 THEN 1 ELSE 0 END)
      ) > 10 THEN 0 ELSE 1 END ASC,
      p.rating DESC,
      wins DESC,
      p.name ASC
```

In the row mapper, derive and return:

```js
    const matchCount = wins + losses;
    const isQualified = matchCount > LONG_TERM_QUALIFICATION_MATCHES;
```

Return these fields:

```js
      matchCount,
      isQualified,
      qualificationLabel: isQualified ? '' : LONG_TERM_PROVISIONAL_LABEL,
```

- [ ] **Step 3: Update monthly SQL ordering and row shaping**

In `listMonthlyLeaderboard`, update the SQL `ORDER BY`:

```sql
    ORDER BY
      CASE WHEN (
        SUM(CASE WHEN m.winner_id = p.id THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m.loser_id = p.id THEN 1 ELSE 0 END)
      ) > 5 THEN 0 ELSE 1 END ASC,
      rating_delta DESC,
      wins DESC,
      p.name ASC
```

In the row mapper, derive and return:

```js
    const matchCount = wins + losses;
    const isQualified = matchCount > MONTHLY_QUALIFICATION_MATCHES;
```

Return these fields:

```js
      matchCount,
      isQualified,
      qualificationLabel: isQualified ? '' : MONTHLY_PROVISIONAL_LABEL,
```

- [ ] **Step 4: Filter monthly honors to qualified rows**

In `settleMonthlyHonors`, replace:

```js
    const champion = listMonthlyLeaderboard(db, month)[0];
```

with:

```js
    const champion = listMonthlyLeaderboard(db, month).find((player) => player.isQualified);
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
pnpm test
```

Expected: all API and rating tests pass. Existing monthly honor tests that created one-match champions may now fail and should be updated in the next task to create qualified champions.

## Task 4: Update Existing Monthly Honor Tests For New Qualification Rule

**Files:**
- Modify: `test/api.test.js`

- [ ] **Step 1: Update completed-month champion test setup**

In `automatically settles completed monthly champions without duplicating honors`, replace the single March match with a loop that records six matches for the champion:

```js
    for (let index = 0; index < 6; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: champion.id,
        loserId: opponent.id,
        score: '3:0',
        playedAt: `2026-03-${String(10 + index).padStart(2, '0')}`,
        note: 'settled month win',
      }, token);
    }
```

Update assertions:

```js
    assert.equal(marchHonors[0].wins, 6);
    assert.equal(marchHonors[0].losses, 0);
    assert.equal(marchHonors[0].matchCount, 6);
```

- [ ] **Step 2: Update monthly honor photo setup**

In `lets admins update and clear monthly honor photos`, replace the single April match with six matches:

```js
    for (let index = 0; index < 6; index += 1) {
      await request(app, 'POST', '/api/matches', {
        winnerId: champion.id,
        loserId: opponent.id,
        score: '3:0',
        playedAt: `2026-04-${String(10 + index).padStart(2, '0')}`,
      }, token);
    }
```

- [ ] **Step 3: Run API tests**

Run:

```bash
pnpm test
```

Expected: all tests pass.

## Task 5: Frontend Provisional Labels

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Render labels in podium players**

In `PodiumPlayer`, near the existing stats or player name block, render:

```jsx
      {player.qualificationLabel && (
        <span className="qualification-label">{player.qualificationLabel}</span>
      )}
```

- [ ] **Step 2: Render labels in rank rows**

In `RankList`, near the player name or metadata, render:

```jsx
              {player.qualificationLabel && (
                <span className="qualification-label">{player.qualificationLabel}</span>
              )}
```

- [ ] **Step 3: Add compact label styles**

Add to `src/styles.css` near rank-row or badge styles:

```css
.qualification-label {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 22px;
  padding: 2px 7px;
  border: 1px solid rgba(120, 113, 108, 0.28);
  border-radius: 999px;
  background: rgba(245, 245, 244, 0.86);
  color: #57534e;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: Vite build exits successfully.

## Task 6: Final Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: both commands exit with code `0`.

- [ ] **Step 2: Inspect changed files**

Run:

```bash
git diff -- server/repositories.js test/api.test.js src/App.jsx src/styles.css
```

Expected: diff only contains ranking qualification fields, qualification-aware sorting, monthly honor filtering, tests, and compact UI labels.

- [ ] **Step 3: Commit implementation**

Only after verification passes:

```bash
git add server/repositories.js test/api.test.js src/App.jsx src/styles.css docs/superpowers/plans/2026-07-01-ranking-qualification.md
git commit -m "feat: add leaderboard qualification rules"
```

