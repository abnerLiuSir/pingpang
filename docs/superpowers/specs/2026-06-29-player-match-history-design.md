# Player Match History Design

Date: 2026-06-29

## Goal

Allow a user to click a player from the public leaderboard and view that player's match history. If the user enters from the long-term leaderboard, the detail page shows all non-reverted matches. If the user enters from the monthly leaderboard, it shows current-month matches. The page also supports filtering the list by opponent.

## Scope

Included:

- Public player match-history page.
- Clickable players from the homepage leaderboard and podium.
- Scope-aware navigation from long-term and monthly leaderboards.
- Opponent filter with a default "all opponents" option.
- Public API for one player's match history.
- Focused API tests for all-time, monthly, and opponent-filtered history.

Not included:

- Admin-only match editing from the public page.
- Historical month picker.
- Charting or rating curves.
- New routing library.

## User Flow

1. A user opens the public homepage.
2. They switch between long-term and monthly leaderboard as needed.
3. They click a player in the active leaderboard view.
4. The app navigates to `/players/:id?scope=all` for long-term or `/players/:id?scope=month` for monthly.
5. The detail page loads the player's scoped record and match list.
6. The user selects an opponent from the dropdown to narrow the match list.
7. The user can return to the homepage from the existing header or a page-level back link.

## Frontend Design

The existing app does not use a client router, so the feature will extend the current `window.location.pathname` routing in `src/App.jsx`.

New route behavior:

- `/` renders `PublicHome`.
- `/players/:id` renders `PlayerHistoryPage`.
- `/admin-score-entry` renders `AdminPage`.
- Unknown public player IDs show an error state with a link back to the leaderboard.

Homepage changes:

- `PodiumPlayer` and `LeaderboardTable` receive the active leaderboard mode.
- Player names, avatars, and rows link to `/players/:id?scope=all` or `/players/:id?scope=month`.
- Existing search and leaderboard switching behavior stays unchanged.

Player history page:

- Header area shows player avatar, name, current rating, scoped wins, losses, win rate, and rating delta.
- A segmented control lets the user switch between "总战绩" and "月战绩" without going back to the homepage.
- Opponent filter is a select control with "全部对手" plus opponents from the scoped match list.
- Match list rows show date, opponent, win/loss result, score, rating delta for this player, and note when present.
- Empty states distinguish between no matches in the selected scope and no matches after opponent filtering.

## Backend Design

Add a public API:

```text
GET /api/players/:id/matches?scope=all|month&opponentId=<id>
```

Response shape:

```json
{
  "player": {
    "id": 1,
    "name": "陈屿",
    "avatarUrl": "",
    "rating": 1517
  },
  "scope": "all",
  "summary": {
    "wins": 3,
    "losses": 1,
    "winRate": 75,
    "ratingDelta": 34,
    "matches": 4
  },
  "opponents": [
    { "id": 2, "name": "林泽" }
  ],
  "matches": [
    {
      "id": 12,
      "playedAt": "2026-06-29",
      "opponentId": 2,
      "opponentName": "林泽",
      "opponentAvatarUrl": "",
      "result": "W",
      "score": "3:1",
      "ratingDelta": 16,
      "playerRatingBefore": 1500,
      "playerRatingAfter": 1516,
      "note": ""
    }
  ]
}
```

Rules:

- Only non-reverted matches are returned.
- `scope=month` uses the current calendar month, matching the monthly leaderboard.
- Missing or unknown players return `404`.
- Invalid `scope` returns `400`.
- `opponentId` is optional; when present it filters to matches where that opponent played against the selected player.
- The `opponents` list is derived from the unfiltered scoped match list so the dropdown remains stable after filtering.

## Error Handling

Frontend:

- Loading state while fetching.
- Error state with retry and leaderboard link if the API fails.
- Empty match state when the selected player has no scoped matches.
- Empty filtered state when an opponent filter removes all matches.

Backend:

- Return `404` for unknown players.
- Return `400` for unsupported scopes.
- Ignore inactive status for history lookup so an existing linked player can still be viewed if they later become inactive.

## Testing

API tests:

- Returns all-time history for a player.
- Returns current-month history when `scope=month`.
- Filters by opponent.
- Excludes reverted matches.
- Returns `404` for unknown player IDs.
- Returns `400` for invalid scope.

Frontend verification:

- Homepage rows and podium players navigate with the correct scope.
- Detail page loads all-time and monthly views.
- Opponent dropdown filters without changing the selected scope.
- Mobile layout remains readable at narrow width.
