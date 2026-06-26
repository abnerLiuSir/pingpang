# PingPang Rating App Design

Date: 2026-06-26

## Product Goal

Build a company-internal web app for recording 1v1 table tennis matches and maintaining personal ratings. The product should feel like a real internal tool: restrained, readable, table-first, and free of obvious AI-generated visual tropes such as neon gradients, decorative glow, oversized rounded cards, or gratuitous motion.

## Confirmed Scope

The MVP includes:

- Public leaderboard homepage at `/`.
- Hidden admin entry at `/admin-score-entry`.
- Simple admin passphrase before score entry.
- 1v1 singles match recording only.
- Elo-style automatic rating calculation.
- Long-term rating leaderboard plus monthly ranking.
- Centralized persistence with Express and SQLite.
- Recent match list and recent-match revert flow.

The MVP does not include:

- Doubles scoring.
- Formal user accounts or role management.
- Cloud database setup.
- Season resets.
- Native mobile apps.

## Product Structure

### Public Homepage

The public homepage is the default view for employees. It should not expose a visible admin entry point.

Primary content:

- Long-term leaderboard with rank, player name, current rating, wins, losses, win rate, recent form, and monthly rating delta.
- A restrained top-three treatment for stronger at-a-glance recognition.
- Monthly leaderboard based on current-month rating delta, wins, losses, and win rate.
- Recent matches list.
- Current month and recent activity counts.
- Player search.
- A control to switch between long-term and monthly leaderboard views.

### Admin Page

The admin page is reached through `/admin-score-entry`.

Admin flow:

1. The recorder enters the passphrase.
2. After validation, the score entry interface is shown.
3. The recorder selects winner, loser, match date, score, and a note when needed.
4. The UI previews Elo rating changes before submission.
5. On submit, the backend records the match and applies rating changes.
6. The success state shows the rating delta and resets the form for continuous entry.
7. The page shows recent matches and allows reverting the most recent match.

## Visual Direction

This is product UI, not a marketing site. The design should serve daily use in an office setting.

Design principles:

- Light, restrained interface with neutral surfaces and one muted accent.
- Tables and lists over card grids.
- Consistent compact controls and form fields.
- Subtle row hover states and clear selected states.
- No decorative glassmorphism, neon, gradient text, or AI-purple/blue styling.
- Motion only for state feedback, around 150 to 250 ms.
- Stable responsive layout for desktop and mobile.

## Technical Approach

Use React + Vite for the frontend, Express for the backend, and SQLite for storage.

Development setup:

- Frontend served by Vite during development.
- Backend served by Express during development.
- Production can serve the built frontend from Express.

Persistence:

- SQLite database stored under `data/pingpang.sqlite`.
- Database initialization should create required tables and seed a small set of sample players for local verification.

## Data Model

### `players`

Stores active players.

Fields:

- `id`
- `name`
- `rating`
- `is_active`
- `created_at`
- `updated_at`

New players start at rating `1500`.

### `matches`

Stores match records and enough rating history to support recent-match reverts.

Fields:

- `id`
- `played_at`
- `winner_id`
- `loser_id`
- `score`
- `winner_rating_before`
- `loser_rating_before`
- `winner_rating_after`
- `loser_rating_after`
- `winner_delta`
- `loser_delta`
- `note`
- `is_reverted`
- `created_at`
- `reverted_at`

### Deferred Table: `rating_events`

The MVP derives rating history from `matches`. A separate event table is outside this MVP and should only be added when rating curves or manual adjustments are implemented.

## Elo Rating Rule

Defaults:

- Initial rating: `1500`.
- K value: `32`.

Expected score:

```text
expected = 1 / (1 + 10 ^ ((opponentRating - playerRating) / 400))
```

Winner delta:

```text
round(K * (1 - winnerExpected))
```

Loser delta:

```text
-winnerDelta
```

Score strings such as `3:0`, `3:1`, and `3:2` are recorded but do not change the Elo weight in the MVP. Weighted scoring can be added later.

## Monthly Ranking

Long-term ratings never reset.

Monthly ranking is derived from matches in the current calendar month:

- Rating net change.
- Wins.
- Losses.
- Win rate.

The homepage should show the long-term leaderboard as the primary view and a monthly leaderboard as a secondary view or adjacent module.

## API Design

### Public APIs

- `GET /api/leaderboard`
  - Returns long-term leaderboard, monthly leaderboard, recent matches, and summary stats.
- `GET /api/players`
  - Returns active players for admin selection.

### Admin APIs

- `POST /api/admin/login`
  - Validates the admin passphrase and returns an admin session token.
- `POST /api/matches/preview`
  - Returns expected rating changes for a winner and loser pair.
- `POST /api/matches`
  - Creates a match and applies rating changes.
- `POST /api/matches/:id/revert`
  - Reverts the most recent non-reverted match only.

Admin APIs require the session token.

## Validation And Error Handling

Frontend and backend should both validate:

- Winner and loser are required.
- Winner and loser cannot be the same player.
- Score must match the allowed singles score format.
- Match date is required.
- Passphrase is required before admin actions.

Backend-specific rules:

- Unauthenticated admin API calls return `401`.
- Invalid input returns `400` with a clear message.
- Revert is only allowed for the most recent non-reverted match.
- Database write failures return a clear error and do not partially update ratings.

Frontend behavior:

- Keep form input when submission fails.
- Show inline form errors near the relevant fields.
- Show a compact success state with rating changes after submission.
- Use skeleton loading states where leaderboard data is loading.
- Use empty states when there are no players or no matches.

## Testing Plan

Unit tests:

- Elo expected score and rating delta calculation.
- Score format validation.
- Monthly leaderboard aggregation.
- Recent-match revert eligibility.

API tests:

- Admin login success and failure.
- Match preview.
- Match creation and rating update.
- Revert most recent match.
- Reject reverting older matches.

Frontend verification:

- Public homepage loads and shows leaderboard data.
- Search and leaderboard switch controls work.
- Admin passphrase flow works.
- Match form previews and submits Elo deltas.
- Error states preserve form input.
- Recent match revert updates the leaderboard.
- Mobile layout is readable at 375 px width.

Visual verification:

- Check that the UI remains restrained and product-like.
- Confirm table rows, form labels, and controls are readable.
- Confirm no decorative gradients, glow effects, glassmorphism, or oversized AI-style card stacks were introduced.
