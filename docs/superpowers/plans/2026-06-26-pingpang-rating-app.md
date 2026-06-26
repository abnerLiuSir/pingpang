# PingPang Rating App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Vite, Express, and SQLite web app for company table tennis Elo ratings.

**Architecture:** The backend owns persistence, Elo calculation, validation, admin session checks, and leaderboard aggregation. The frontend consumes JSON APIs and renders a public leaderboard plus a hidden admin score-entry page. Shared behavior is kept in focused backend modules and tested before UI work.

**Tech Stack:** React, Vite, Express, better-sqlite3, Vitest, Supertest, CSS.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`: Vite frontend.
- `server/index.js`: Express app entry point and static serving.
- `server/app.js`: app factory for production and tests.
- `server/db.js`: SQLite connection, schema creation, and seed data.
- `server/rating.js`: Elo calculation.
- `server/validation.js`: score and match validation.
- `server/repositories.js`: database reads and writes.
- `server/routes.js`: API routes.
- `test/rating.test.js`: Elo tests.
- `test/validation.test.js`: score validation tests.
- `test/api.test.js`: API integration tests with temporary SQLite databases.

## Tasks

### Task 1: Project Skeleton

- [ ] Create npm/Vite/Express project files.
- [ ] Install dependencies.
- [ ] Run baseline test command and confirm the empty test suite runs.

### Task 2: Rating And Validation

- [ ] Write failing tests for Elo deltas and score validation.
- [ ] Implement `server/rating.js` and `server/validation.js`.
- [ ] Run tests and confirm they pass.

### Task 3: Database And Repositories

- [ ] Write API-level failing tests for login, leaderboard, match preview, match creation, and revert behavior.
- [ ] Implement SQLite schema, seed data, repository functions, and route handlers.
- [ ] Run API tests and confirm they pass.

### Task 4: Frontend Public Homepage

- [ ] Implement public leaderboard loading, search, long-term/monthly switch, recent matches, loading state, empty state, and error state.
- [ ] Verify the homepage against the approved public leaderboard structure.

### Task 5: Frontend Admin Page

- [ ] Implement passphrase login, match form, preview, submit success state, inline errors, recent match list, and most-recent revert.
- [ ] Verify the admin flow manually in browser.

### Task 6: Final Verification

- [ ] Run unit and API tests.
- [ ] Run production build.
- [ ] Start the app and verify desktop and mobile layouts with browser screenshots.
- [ ] Compare the implementation against the approved companion mockup and design doc.
