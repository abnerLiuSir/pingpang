# Ranking Qualification Design

Date: 2026-07-01

## Problem

The current leaderboard starts every player at `1500` and sorts the long-term board directly by rating. This creates two unfair-looking cases:

- A player with zero or very few matches can rank above active players who have lost rating.
- A player who wins one early match can appear too high before their rating is trustworthy.

The rating formula itself is not the main issue. The app needs to separate rating value from ranking qualification.

## Confirmed Direction

Keep the existing Elo system and default K value unchanged.

Add qualification rules around leaderboards:

- Long-term official ranking requires more than `10` total active matches.
- Monthly official ranking requires more than `5` active matches in that month.
- Players below the threshold remain visible, but are marked as provisional.
- Provisional players appear after qualified players instead of being hidden.

This keeps the board transparent while preventing low-activity players from occupying official ranking spots.

## Long-Term Leaderboard

The long-term leaderboard should include all active players.

For each player, derive:

- `wins`
- `losses`
- `matchCount = wins + losses`
- `isQualified = matchCount > 10`
- `qualificationLabel`, such as `定级中`

Sorting:

1. Qualified players first.
2. Provisional players second.
3. Within each group, sort by rating descending.
4. Tie-break by wins descending.
5. Tie-break by name ascending.

Ranks should reflect official ranking positions. Qualified players receive normal rank numbers. Provisional rows should be visually marked so they are not mistaken for official top-ranked players.

## Monthly Leaderboard And Honors

The monthly leaderboard should include players who have active matches in the selected month.

For each monthly player row, derive:

- `wins`
- `losses`
- `matchCount = wins + losses`
- `isQualified = matchCount > 5`
- `qualificationLabel`, such as `本月场次不足`

Sorting:

1. Monthly qualified players first.
2. Monthly provisional players second.
3. Within each group, sort by rating delta descending.
4. Tie-break by wins descending.
5. Tie-break by name ascending.

Monthly honor settlement should only choose a champion from qualified monthly rows. If no player in a completed month has more than `5` matches, the app should not create a monthly honor for that month.

## Rating Rule

Do not change the existing K value.

The app keeps:

- Initial rating: `1500`.
- Default K: `32`.
- Existing Elo expected-score calculation.
- Existing score multiplier behavior.

This keeps historical recalculation stable and avoids changing player ratings just to fix a display/ranking trust problem.

## API Changes

Leaderboard player rows should include:

- `matchCount`
- `isQualified`
- `qualificationLabel`

These fields should be returned for both:

- `longTerm`
- `monthly`

Existing fields such as `rating`, `ratingDelta`, `wins`, `losses`, `winRate`, and `recentForm` remain unchanged.

## UI Changes

The public leaderboard should keep the same overall layout.

Required behavior:

- Qualified players appear first.
- Provisional players remain visible below qualified players.
- Provisional rows show a compact label:
  - Long-term: `定级中`
  - Monthly: `本月场次不足`
- Existing rating and win/loss information remain visible.

The UI should not explain the whole rule inline. It only needs enough labeling to prevent provisional players from looking like official rank leaders.

## Testing Plan

Unit/API tests should cover:

- Long-term players with `0`, `1`, `10`, and `11` matches.
- Long-term sorting keeps provisional high-rating players below qualified players.
- Monthly players with `5` matches remain provisional.
- Monthly players with `6` matches qualify.
- Monthly honor settlement ignores provisional leaders.
- Existing Elo delta tests continue to pass without K changes.

