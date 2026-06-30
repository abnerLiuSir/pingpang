# Monthly Honor Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automatically settled monthly honor board where each completed month's champion receives a gold medal entry and admins can upload a champion photo.

**Architecture:** Add a persisted `monthly_honors` table and repository functions that settle completed months opportunistically. Extend the existing leaderboard response with settled honors, add admin-protected honor photo endpoints, and reuse the existing React upload/crop UI for admin photo management. Keep current live monthly leaderboard behavior unchanged.

**Tech Stack:** Node.js 24, `node:sqlite`, Express, React 18, Vite, Node test runner.

---

## File Structure

- Modify `server/db.js`: create the `monthly_honors` table during database initialization.
- Modify `server/repositories.js`: add honor row shaping, settlement logic, public listing, admin listing, and photo update functions.
- Modify `server/routes.js`: expose public honor data through `/api/leaderboard` and add admin endpoints for honor listing/photo updates.
- Modify `test/api.test.js`: add API coverage for automatic settlement and admin photo updates.
- Modify `src/App.jsx`: render public monthly honor cards, load/edit honor photos in admin, and reuse `AvatarUploader`.
- Modify `src/styles.css`: add honor card and admin honor panel styling, responsive with current layout.

## Task 1: Database Schema

**Files:**
- Modify: `server/db.js`
- Test: `test/api.test.js`

- [ ] **Step 1: Write the failing schema test**

Add this test inside the existing `describe('api', () => { ... })` block in `test/api.test.js`:

```js
  it('initializes monthly honors storage', async () => {
    const columns = db.prepare("PRAGMA table_info(monthly_honors)").all().map((column) => column.name);

    assert.deepEqual(columns, [
      'id',
      'month',
      'player_id',
      'rating_delta',
      'wins',
      'losses',
      'match_count',
      'medal',
      'photo_url',
      'settled_at',
      'updated_at',
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`

Expected: FAIL because `monthly_honors` does not exist and `columns` is `[]`.

- [ ] **Step 3: Implement the table**

In `server/db.js`, add this SQL after the `matches` table creation:

```js
    CREATE TABLE IF NOT EXISTS monthly_honors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      player_id INTEGER NOT NULL REFERENCES players(id),
      rating_delta INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      match_count INTEGER NOT NULL,
      medal TEXT NOT NULL DEFAULT 'gold',
      photo_url TEXT NOT NULL DEFAULT '',
      settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db.js test/api.test.js
git commit -m "feat: add monthly honor storage"
```

## Task 2: Repository Settlement Logic

**Files:**
- Modify: `server/repositories.js`
- Test: `test/api.test.js`

- [ ] **Step 1: Write failing API tests for automatic settlement**

Add these tests inside the existing `describe('api', () => { ... })` block in `test/api.test.js`:

```js
  it('automatically settles completed monthly champions without duplicating honors', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const champion = (await request(app, 'POST', '/api/players', { name: 'June Honor Champion' }, token)).data.player;
    const opponent = (await request(app, 'POST', '/api/players', { name: 'June Honor Opponent' }, token)).data.player;

    await request(app, 'POST', '/api/matches', {
      winnerId: champion.id,
      loserId: opponent.id,
      score: '3:0',
      playedAt: '2026-05-15',
      note: 'settled month win',
    }, token);

    const first = await request(app, 'GET', '/api/leaderboard');
    const second = await request(app, 'GET', '/api/leaderboard');
    const mayHonors = first.data.monthlyHonors.filter((honor) => honor.month === '2026-05');

    assert.equal(first.status, 200);
    assert.equal(mayHonors.length, 1);
    assert.equal(mayHonors[0].playerId, champion.id);
    assert.equal(mayHonors[0].playerName, champion.name);
    assert.equal(mayHonors[0].medal, 'gold');
    assert.equal(mayHonors[0].wins, 1);
    assert.equal(mayHonors[0].losses, 0);
    assert.equal(mayHonors[0].matchCount, 1);
    assert.equal(mayHonors[0].ratingDelta > 0, true);
    assert.equal(second.data.monthlyHonors.filter((honor) => honor.month === '2026-05').length, 1);
  });

  it('does not settle the current month into monthly honors', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const champion = (await request(app, 'POST', '/api/players', { name: 'Current Honor Champion' }, token)).data.player;
    const opponent = (await request(app, 'POST', '/api/players', { name: 'Current Honor Opponent' }, token)).data.player;

    await request(app, 'POST', '/api/matches', {
      winnerId: champion.id,
      loserId: opponent.id,
      score: '3:1',
      playedAt: '2026-06-20',
    }, token);

    const leaderboard = await request(app, 'GET', '/api/leaderboard');

    assert.equal(leaderboard.status, 200);
    assert.equal(leaderboard.data.monthly.some((player) => player.id === champion.id), true);
    assert.equal(leaderboard.data.monthlyHonors.some((honor) => honor.playerId === champion.id && honor.month === '2026-06'), false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`

Expected: FAIL because `monthlyHonors` is missing from `/api/leaderboard`.

- [ ] **Step 3: Add repository helpers**

In `server/repositories.js`, add these functions near the existing row shaping helpers:

```js
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
```

- [ ] **Step 4: Refactor month prefix use**

Replace local month prefix construction in `getLeaderboard` and `listPlayerHistoryMatches` with:

```js
const monthPrefix = currentMonthPrefix(now);
```

- [ ] **Step 5: Add month ranking and settlement functions**

Add these exports in `server/repositories.js` before `getLeaderboard`:

```js
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
```

- [ ] **Step 6: Include honors in public leaderboard**

Change `getLeaderboard` in `server/repositories.js` so the returned object includes `monthlyHonors`:

```js
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
```

- [ ] **Step 7: Run tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/repositories.js test/api.test.js
git commit -m "feat: settle monthly honors"
```

## Task 3: Admin Honor Photo API

**Files:**
- Modify: `server/repositories.js`
- Modify: `server/routes.js`
- Test: `test/api.test.js`

- [ ] **Step 1: Write failing API test for admin photo updates**

Add this test inside `describe('api', () => { ... })` in `test/api.test.js`:

```js
  it('lets admins update and clear monthly honor photos', async () => {
    const login = await request(app, 'POST', '/api/admin/login', { passphrase: 'score-keeper' });
    const token = login.data.token;

    const champion = (await request(app, 'POST', '/api/players', { name: 'Photo Honor Champion' }, token)).data.player;
    const opponent = (await request(app, 'POST', '/api/players', { name: 'Photo Honor Opponent' }, token)).data.player;

    await request(app, 'POST', '/api/matches', {
      winnerId: champion.id,
      loserId: opponent.id,
      score: '3:0',
      playedAt: '2026-04-12',
    }, token);

    const honors = await request(app, 'GET', '/api/admin/monthly-honors', undefined, token);
    const honor = honors.data.monthlyHonors.find((entry) => entry.month === '2026-04');
    const photoUrl = `data:image/jpeg;base64,${'c'.repeat(180_000)}`;

    assert.equal(honors.status, 200);
    assert.equal(honor.playerId, champion.id);

    const updated = await request(app, 'PATCH', `/api/admin/monthly-honors/${honor.id}`, {
      photoUrl,
    }, token);

    assert.equal(updated.status, 200);
    assert.equal(updated.data.monthlyHonor.photoUrl, photoUrl);

    const publicLeaderboard = await request(app, 'GET', '/api/leaderboard');
    assert.equal(publicLeaderboard.data.monthlyHonors.find((entry) => entry.id === honor.id).photoUrl, photoUrl);

    const cleared = await request(app, 'PATCH', `/api/admin/monthly-honors/${honor.id}`, {
      photoUrl: '',
    }, token);

    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.monthlyHonor.photoUrl, '');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test`

Expected: FAIL with `404` for `/api/admin/monthly-honors`.

- [ ] **Step 3: Add repository update function**

In `server/repositories.js`, add:

```js
export function updateMonthlyHonor(db, id, { photoUrl }) {
  const existing = db.prepare('SELECT id FROM monthly_honors WHERE id = ?').get(Number(id));
  if (!existing) {
    return { valid: false, message: 'Monthly honor was not found.' };
  }

  db.prepare('UPDATE monthly_honors SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(String(photoUrl || '').trim(), Number(id));

  const monthlyHonor = db.prepare(`
    SELECT
      h.*,
      p.name AS player_name,
      p.avatar_url AS player_avatar_url
    FROM monthly_honors h
    JOIN players p ON p.id = h.player_id
    WHERE h.id = ?
  `).get(Number(id));

  return { valid: true, monthlyHonor: rowToMonthlyHonor(monthlyHonor) };
}
```

- [ ] **Step 4: Wire routes**

In `server/routes.js`, add `listMonthlyHonors` and `updateMonthlyHonor` to the repository import:

```js
  listMonthlyHonors,
  updateMonthlyHonor,
```

Add these routes after `/admin/players`:

```js
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
```

- [ ] **Step 5: Run tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/repositories.js server/routes.js test/api.test.js
git commit -m "feat: manage monthly honor photos"
```

## Task 4: Public Honor Board UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add public component**

In `src/App.jsx`, add this component near `MonthlyPanel`:

```jsx
function MonthlyHonorBoard({ honors }) {
  return (
    <section className="compact-panel honor-panel">
      <div className="panel-heading compact">
        <div>
          <h2>月度荣誉榜</h2>
        </div>
        <Medal size={18} aria-hidden="true" />
      </div>
      {honors.length ? (
        <div className="honor-list">
          {honors.slice(0, 6).map((honor) => (
            <article className="honor-card" key={honor.id}>
              <div className="honor-photo">
                {honor.photoUrl ? (
                  <img src={honor.photoUrl} alt={`${formatHonorMonth(honor.month)} ${honor.playerName} 冠军照片`} loading="lazy" />
                ) : (
                  <Medal size={28} aria-hidden="true" />
                )}
              </div>
              <div className="honor-info">
                <span className="honor-month">{formatHonorMonth(honor.month)}</span>
                <div className="honor-player">
                  <PlayerAvatar player={{ name: honor.playerName, avatarUrl: honor.playerAvatarUrl }} className="small-avatar" />
                  <strong title={honor.playerName}>{honor.playerName}</strong>
                </div>
                <div className="honor-meta">
                  <Delta value={honor.ratingDelta} />
                  <span>{honor.wins}胜{honor.losses}负</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-copy">还没有已结算的月度荣誉。</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Render public component**

In `PublicHome`, inside the `matches-area` aside after `<MonthlyPanel players={data.monthly} />`, add:

```jsx
            <MonthlyHonorBoard honors={data.monthlyHonors || []} />
```

- [ ] **Step 3: Add month formatter**

Add this helper near date formatters:

```js
function formatHonorMonth(value) {
  if (!value) return '--';
  const [year, month] = String(value).split('-');
  return `${year}年${Number(month)}月`;
}
```

- [ ] **Step 4: Add styles**

In `src/styles.css`, add:

```css
.honor-panel {
  display: grid;
  gap: 12px;
}

.honor-list {
  display: grid;
  gap: 12px;
}

.honor-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
  border-top: 1px solid #f5f5f5;
  padding-top: 12px;
}

.honor-card:first-child {
  border-top: 0;
  padding-top: 0;
}

.honor-photo {
  display: grid;
  min-height: 88px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(234, 179, 8, 0.42);
  border-radius: 12px;
  background: #fef9c3;
  color: #ca8a04;
}

.honor-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.honor-info {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 8px;
}

.honor-month {
  color: #ca8a04;
  font-size: 13px;
  font-weight: 900;
}

.honor-player {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.honor-player strong {
  overflow: hidden;
  color: #404040;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.honor-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}
```

- [ ] **Step 5: Run build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: show monthly honor board"
```

## Task 5: Admin Honor Photo UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add admin state**

In `AdminPage`, add state next to existing admin collections:

```js
  const [monthlyHonors, setMonthlyHonors] = useState([]);
  const [honorPhotoDrafts, setHonorPhotoDrafts] = useState({});
```

- [ ] **Step 2: Load honors with admin data**

In `loadAdminData`, add:

```js
      const honorResult = await apiRequest('/admin/monthly-honors', { token });
```

Then after setting players/matches/leaderboard, add:

```js
      setMonthlyHonors(honorResult.monthlyHonors);
      setHonorPhotoDrafts(Object.fromEntries(honorResult.monthlyHonors.map((honor) => [honor.id, honor.photoUrl || ''])));
```

- [ ] **Step 3: Add save function**

In `AdminPage`, add:

```js
  async function saveMonthlyHonorPhoto(honor) {
    setBusy(true);
    setFormError('');
    setSuccess(null);
    try {
      const result = await apiRequest(`/admin/monthly-honors/${honor.id}`, {
        method: 'PATCH',
        token,
        body: {
          photoUrl: honorPhotoDrafts[honor.id] || '',
        },
      });
      setMonthlyHonors((current) => current.map((entry) => (entry.id === honor.id ? result.monthlyHonor : entry)));
      setHonorPhotoDrafts((current) => ({ ...current, [honor.id]: result.monthlyHonor.photoUrl || '' }));
      setSuccess('月度荣誉照片已保存。');
      await loadLeaderboardOnly();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 4: Add admin component**

Add this component near `PanelTitle`:

```jsx
function MonthlyHonorManager({ honors, drafts, onDraftChange, onSave, busy }) {
  return (
    <section className="entry-panel honor-manager">
      <PanelTitle label="Honors" title="月度荣誉" icon={<Medal size={18} aria-hidden="true" />} />
      {honors.length ? honors.map((honor) => (
        <div className="honor-admin-row" key={honor.id}>
          <div className="honor-admin-summary">
            <span>{formatHonorMonth(honor.month)}</span>
            <strong>{honor.playerName}</strong>
            <small>{honor.wins}胜{honor.losses}负 · <Delta value={honor.ratingDelta} /></small>
          </div>
          <AvatarUploader
            label="冠军照片"
            value={drafts[honor.id] || ''}
            name={honor.playerName}
            onChange={(value) => onDraftChange(honor.id, value)}
          />
          <button className="secondary-button" onClick={() => onSave(honor)} disabled={busy}>
            <Save size={15} aria-hidden="true" />
            保存照片
          </button>
        </div>
      )) : (
        <EmptyState title="暂无月度荣誉" body="有已结束月份的比赛后，系统会自动生成月度冠军。" />
      )}
    </section>
  );
}
```

- [ ] **Step 5: Render admin manager**

In `AdminPage`, after the match manager section, add:

```jsx
      <MonthlyHonorManager
        honors={monthlyHonors}
        drafts={honorPhotoDrafts}
        onDraftChange={(honorId, value) => setHonorPhotoDrafts((current) => ({ ...current, [honorId]: value }))}
        onSave={saveMonthlyHonorPhoto}
        busy={busy}
      />
```

- [ ] **Step 6: Add admin styles**

In `src/styles.css`, add:

```css
.honor-manager {
  max-height: 560px;
  margin-top: 24px;
  overflow-y: auto;
}

.honor-admin-row {
  display: grid;
  grid-template-columns: minmax(160px, 0.8fr) minmax(220px, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-top: 1px solid #f5f5f5;
  padding: 14px 0;
}

.honor-admin-row:first-of-type {
  border-top: 0;
}

.honor-admin-summary {
  display: grid;
  gap: 4px;
}

.honor-admin-summary span {
  color: #ca8a04;
  font-size: 13px;
  font-weight: 900;
}

.honor-admin-summary strong {
  color: #404040;
}

.honor-admin-summary small {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--muted);
}
```

Inside the existing `@media (max-width: 720px)` block, add:

```css
  .honor-card,
  .honor-admin-row {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 7: Run build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: edit monthly honor photos"
```

## Task 6: Final Verification

**Files:**
- Verify only unless failures require fixes.

- [ ] **Step 1: Run tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run: `pnpm dev`

Expected: client and server start. Open the local URL printed by Vite, usually `http://localhost:5173/`.

- [ ] **Step 4: Manual smoke verification**

Use the app:

- Open `/` and confirm the right column includes "月度荣誉榜".
- Open `/admin-score-entry`, log in with the configured passphrase, and confirm "月度荣誉" appears.
- If test data includes completed-month honors, upload a photo, save it, return to `/`, and confirm the public honor card shows the photo.

- [ ] **Step 5: Commit any verification fixes**

If verification required code fixes:

```bash
git add server src test
git commit -m "fix: polish monthly honor board"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Automatic completed-month settlement is covered by Tasks 1 and 2.
- Stable persisted honor entries are covered by the `monthly_honors` table and `INSERT OR IGNORE`.
- Public honor board is covered by Task 4.
- Admin photo upload is covered by Tasks 3 and 5.
- No public uploads or manual champion override are introduced.
- API and build verification are covered by Tasks 2, 3, and 6.

Placeholder scan:

- No `TBD`, `TODO`, or undefined future work is required to complete this plan.

Type consistency:

- API uses `monthlyHonors` publicly and administratively.
- Repository update result uses `{ valid, monthlyHonor }`.
- Frontend honor fields match the API shape: `id`, `month`, `playerName`, `playerAvatarUrl`, `ratingDelta`, `wins`, `losses`, `photoUrl`.

