import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SEED_PLAYERS = ['陈屿', '林泽', '周启', '许航', '唐越', '郑闻', '梁牧', '贺岚'];

export function openDatabase(databasePath) {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new DatabaseSync(resolvedPath);
  initializeDatabase(db);
  return db;
}

export function initializeDatabase(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      avatar_url TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 1500,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      played_at TEXT NOT NULL,
      winner_id INTEGER NOT NULL REFERENCES players(id),
      loser_id INTEGER NOT NULL REFERENCES players(id),
      score TEXT NOT NULL,
      winner_rating_before INTEGER NOT NULL,
      loser_rating_before INTEGER NOT NULL,
      winner_rating_after INTEGER NOT NULL,
      loser_rating_after INTEGER NOT NULL,
      winner_delta INTEGER NOT NULL,
      loser_delta INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      is_reverted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reverted_at TEXT
    );

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
  `);

  const playerColumns = db.prepare("PRAGMA table_info(players)").all().map((column) => column.name);
  if (!playerColumns.includes('avatar_url')) {
    db.exec("ALTER TABLE players ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }

  const existing = db.prepare('SELECT COUNT(*) AS count FROM players').get().count;
  if (existing === 0) {
    const insert = db.prepare('INSERT INTO players (name, rating) VALUES (?, 1500)');
    for (const name of SEED_PLAYERS) {
      insert.run(name);
    }
  }
}
