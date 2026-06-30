# Monthly Honor Board Design

Date: 2026-06-30

## Goal

Add a monthly honor board for the ping-pong rating app. Each completed month is settled automatically. The first-place player for that month receives a gold medal entry, and an admin can upload a photo for that monthly champion.

## Scope

Included:

- Public monthly honor board showing settled monthly champions.
- Automatic settlement for completed months only.
- Admin-only photo upload, replacement, and removal for each honor entry.
- SQLite persistence for settled honor entries and photos.
- API tests for settlement, photo updates, and public visibility.
- Frontend updates for homepage display and admin management.

Not included:

- Manual champion override.
- Public user uploads.
- Multiple medal levels per month.
- Historical month picker for the existing live monthly leaderboard.
- External file storage or object storage.

## Settlement Rules

The system creates honor entries for completed months. The current month remains live in the existing monthly leaderboard and is not added to the honor board until the next month begins.

For each completed month:

- Consider only non-reverted matches whose `played_at` date starts with that month.
- Rank players by the same logic as the current monthly leaderboard: rating delta descending, wins descending, then name ascending.
- Create one honor entry for the first-ranked player.
- Do not create an entry for months with no matches.
- Do not create duplicate entries for a month that is already settled.

The settlement process runs opportunistically before returning leaderboard or honor-board data and before loading the admin honor management panel. This avoids a separate scheduler while still making settlement automatic.

If an old match is edited or deleted after a month has settled, the existing honor entry remains stable. This matches the product meaning of a monthly closing result. Later work can add an explicit admin "recalculate month" action if needed.

## Data Model

Add a `monthly_honors` table:

```sql
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

`photo_url` stores the same kind of value already used by player avatars: either an external image URL or a cropped `data:image/...` URL. This keeps the implementation consistent with the existing admin avatar uploader and avoids new storage infrastructure.

## Backend Design

Repository functions:

- `settleMonthlyHonors(db, now)` finds completed months with matches and inserts missing honor entries.
- `listMonthlyHonors(db, now)` runs settlement, then returns honors ordered by month descending.
- `updateMonthlyHonor(db, id, { photoUrl })` updates the admin-managed photo.
- Shared monthly ranking logic is extracted so the live monthly leaderboard and settlement use the same ordering.

Public API:

```text
GET /api/leaderboard
```

Adds a `monthlyHonors` array to the existing response.

```json
{
  "monthlyHonors": [
    {
      "id": 1,
      "month": "2026-06",
      "playerId": 2,
      "playerName": "林泽",
      "playerAvatarUrl": "",
      "ratingDelta": 42,
      "wins": 4,
      "losses": 1,
      "matchCount": 5,
      "medal": "gold",
      "photoUrl": "",
      "settledAt": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

Admin API:

```text
GET /api/admin/monthly-honors
PATCH /api/admin/monthly-honors/:id
```

The patch endpoint accepts `photoUrl`. It is admin-protected like player and match management.

## Frontend Design

Homepage:

- Keep the current long-term and live monthly leaderboard behavior.
- Add a compact "月度荣誉榜" section in the right column below the live monthly panel.
- Show the latest settled honors in reverse chronological order.
- Each honor shows month, gold medal icon, champion avatar/name, rating delta, win-loss record, and uploaded photo when present.
- Empty state says no settled monthly honors yet.

Admin page:

- Add a "月度荣誉" management panel after match management or beside existing admin panels if layout allows.
- Load settled honor entries after admin login.
- Each row shows month, champion, medal, monthly record, and an `AvatarUploader`-style photo control.
- Admin can save or remove only the photo. Champion fields are read-only because settlement is automatic.

The visual style should reuse existing panels, buttons, icons, rounded radii, and upload crop modal. No new routing library is needed.

## Error Handling

Backend:

- Unknown honor ID returns `400` with a clear message.
- Missing admin token returns `401`, matching existing admin endpoints.
- `photoUrl` is normalized by trimming whitespace.

Frontend:

- Public honor board renders an empty state if there are no settled months.
- Admin panel shows the existing global error message when honor loading or saving fails.
- Upload errors use the existing image cropper behavior.

## Testing

API tests:

- A completed month with matches is automatically settled and returned on the public leaderboard.
- The current month is not settled.
- Months with no matches are ignored.
- A settled month does not duplicate on repeated requests.
- Admin can update and clear an honor photo.
- Public leaderboard includes the updated photo.

Frontend verification:

- Homepage shows monthly honors without breaking the existing leaderboard.
- Admin can upload, save, and remove an honor photo.
- Mobile layout remains readable with honor cards stacked.

