import type { SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workout_template (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS template_exercise (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id   INTEGER NOT NULL REFERENCES workout_template(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      default_sets  INTEGER NOT NULL DEFAULT 3,
      default_reps  INTEGER NOT NULL DEFAULT 10,
      default_weight REAL NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS template_set (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id  INTEGER NOT NULL REFERENCES template_exercise(id) ON DELETE CASCADE,
      set_number   INTEGER NOT NULL,
      reps         INTEGER NOT NULL DEFAULT 10,
      weight       REAL NOT NULL DEFAULT 0,
      rest_seconds INTEGER NOT NULL DEFAULT 90
    );

    CREATE TABLE IF NOT EXISTS workout_session (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_template(id),
      started_at  TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS session_set (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
      exercise_name TEXT NOT NULL,
      set_number    INTEGER NOT NULL,
      reps          INTEGER NOT NULL DEFAULT 0,
      weight        REAL NOT NULL DEFAULT 0,
      completed     INTEGER NOT NULL DEFAULT 0
    );
  `);
}
