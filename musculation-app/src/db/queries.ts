import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  WorkoutTemplateWithMeta,
  WorkoutTemplate,
  TemplateExercise,
  WorkoutSessionWithName,
  SessionSet,
  SetInput,
} from '../types/models';

// ─── Templates ───

export async function getAllTemplates(db: SQLiteDatabase): Promise<WorkoutTemplateWithMeta[]> {
  return db.getAllAsync<WorkoutTemplateWithMeta>(`
    SELECT wt.*,
           COUNT(te.id) as exercise_count,
           (SELECT MAX(ws.started_at) FROM workout_session ws
            WHERE ws.template_id = wt.id AND ws.finished_at IS NOT NULL) as last_session_date
    FROM workout_template wt
    LEFT JOIN template_exercise te ON te.template_id = wt.id
    GROUP BY wt.id
    ORDER BY wt.sort_order ASC
  `);
}

export async function updateTemplatesOrder(db: SQLiteDatabase, orderedIds: number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync('UPDATE workout_template SET sort_order = ? WHERE id = ?', i, orderedIds[i]);
  }
}

export async function getTemplateById(db: SQLiteDatabase, id: number): Promise<WorkoutTemplate | null> {
  return db.getFirstAsync<WorkoutTemplate>('SELECT * FROM workout_template WHERE id = ?', id);
}

export async function getTemplateExercises(db: SQLiteDatabase, templateId: number): Promise<TemplateExercise[]> {
  return db.getAllAsync<TemplateExercise>(
    'SELECT * FROM template_exercise WHERE template_id = ? ORDER BY sort_order',
    templateId
  );
}

export interface TemplateSet {
  id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_seconds: number;
}

export async function getTemplateSets(db: SQLiteDatabase, templateId: number): Promise<TemplateSet[]> {
  return db.getAllAsync<TemplateSet>(`
    SELECT ts.id, ts.exercise_id, ts.set_number, ts.reps, ts.weight, ts.rest_seconds
    FROM template_set ts
    JOIN template_exercise te ON te.id = ts.exercise_id
    WHERE te.template_id = ?
    ORDER BY te.sort_order, ts.set_number
  `, templateId);
}

export interface ExerciseInput {
  name: string;
  sets: SetInput[];
}

export async function createTemplate(
  db: SQLiteDatabase,
  name: string,
  exercises: ExerciseInput[]
): Promise<number> {
  const maxOrder = await db.getFirstAsync<{ v: number | null }>('SELECT MAX(sort_order) as v FROM workout_template');
  const newSortOrder = (maxOrder?.v ?? -1) + 1;

  const result = await db.runAsync(
    'INSERT INTO workout_template (name, sort_order) VALUES (?, ?)',
    name, newSortOrder
  );
  const templateId = Number(result.lastInsertRowId);

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const first = ex.sets[0];
    const exResult = await db.runAsync(
      `INSERT INTO template_exercise
        (template_id, name, default_sets, default_reps, default_weight, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      templateId, ex.name, ex.sets.length,
      first?.reps ?? 0, first?.weight ?? 0,
      i
    );
    const exerciseId = Number(exResult.lastInsertRowId);

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      await db.runAsync(
        'INSERT INTO template_set (exercise_id, set_number, reps, weight, rest_seconds) VALUES (?, ?, ?, ?, ?)',
        exerciseId, j + 1, s.reps, s.weight, s.restSeconds ?? 90
      );
    }
  }

  return templateId;
}

export async function updateTemplate(
  db: SQLiteDatabase,
  id: number,
  name: string,
  exercises: ExerciseInput[]
): Promise<void> {
  await db.runAsync(
    "UPDATE workout_template SET name = ?, updated_at = datetime('now') WHERE id = ?",
    name, id
  );
  // CASCADE deletes template_set rows automatically
  await db.runAsync('DELETE FROM template_exercise WHERE template_id = ?', id);

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const first = ex.sets[0];
    const exResult = await db.runAsync(
      `INSERT INTO template_exercise
        (template_id, name, default_sets, default_reps, default_weight, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id, ex.name, ex.sets.length,
      first?.reps ?? 0, first?.weight ?? 0,
      i
    );
    const exerciseId = Number(exResult.lastInsertRowId);

    for (let j = 0; j < ex.sets.length; j++) {
      const s = ex.sets[j];
      await db.runAsync(
        'INSERT INTO template_set (exercise_id, set_number, reps, weight, rest_seconds) VALUES (?, ?, ?, ?, ?)',
        exerciseId, j + 1, s.reps, s.weight, s.restSeconds ?? 90
      );
    }
  }
}

export async function deleteTemplate(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_session WHERE template_id = ?', id);
  await db.runAsync('DELETE FROM workout_template WHERE id = ?', id);
}

// ─── Sessions ───

export interface LastSessionSet {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number;
}

export async function getLastSessionSets(
  db: SQLiteDatabase,
  templateId: number
): Promise<LastSessionSet[]> {
  const lastSession = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM workout_session
     WHERE template_id = ? AND finished_at IS NOT NULL
     ORDER BY started_at DESC LIMIT 1`,
    templateId
  );

  if (!lastSession) return [];

  return db.getAllAsync<LastSessionSet>(
    `SELECT exercise_name, set_number, reps, weight
     FROM session_set
     WHERE session_id = ?
     ORDER BY exercise_name, set_number`,
    lastSession.id
  );
}

export interface BestPerformance {
  exercise_name: string;
  best_weight: number;
  best_reps: number;
}

export async function getBestPerformanceByExercise(
  db: SQLiteDatabase,
  templateId: number
): Promise<BestPerformance[]> {
  return db.getAllAsync<BestPerformance>(`
    SELECT ss.exercise_name,
           ss.weight as best_weight,
           MAX(ss.reps) as best_reps
    FROM session_set ss
    JOIN workout_session ws ON ws.id = ss.session_id
    WHERE ws.template_id = ? AND ws.finished_at IS NOT NULL
      AND ss.weight = (
        SELECT MAX(ss2.weight)
        FROM session_set ss2
        JOIN workout_session ws2 ON ws2.id = ss2.session_id
        WHERE ws2.template_id = ? AND ws2.finished_at IS NOT NULL
          AND ss2.exercise_name = ss.exercise_name
      )
    GROUP BY ss.exercise_name
  `, templateId, templateId);
}

export async function createSession(db: SQLiteDatabase, templateId: number): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO workout_session (template_id) VALUES (?)',
    templateId
  );
  return Number(result.lastInsertRowId);
}

export async function saveSessionSets(
  db: SQLiteDatabase,
  sessionId: number,
  exercises: {
    name: string;
    sets: {
      setNumber: number;
      reps: number;
      weight: number;
      completed: boolean;
    }[];
  }[]
): Promise<void> {
  await db.runAsync('DELETE FROM session_set WHERE session_id = ?', sessionId);

  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      await db.runAsync(
        `INSERT INTO session_set
          (session_id, exercise_name, set_number, reps, weight, completed)
         VALUES (?, ?, ?, ?, ?, ?)`,
        sessionId, exercise.name, set.setNumber,
        set.reps, set.weight,
        set.completed ? 1 : 0
      );
    }
  }
}

export async function finishSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.runAsync(
    "UPDATE workout_session SET finished_at = datetime('now') WHERE id = ?",
    sessionId
  );
}

export async function deleteSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_session WHERE id = ?', sessionId);
}

export async function getSessionHistory(db: SQLiteDatabase): Promise<WorkoutSessionWithName[]> {
  return db.getAllAsync<WorkoutSessionWithName>(`
    SELECT ws.*, wt.name as template_name
    FROM workout_session ws
    JOIN workout_template wt ON wt.id = ws.template_id
    WHERE ws.finished_at IS NOT NULL
    ORDER BY ws.started_at DESC
  `);
}

export async function getSessionDetail(db: SQLiteDatabase, sessionId: number): Promise<{
  session: WorkoutSessionWithName;
  sets: SessionSet[];
} | null> {
  const session = await db.getFirstAsync<WorkoutSessionWithName>(`
    SELECT ws.*, wt.name as template_name
    FROM workout_session ws
    JOIN workout_template wt ON wt.id = ws.template_id
    WHERE ws.id = ?
  `, sessionId);

  if (!session) return null;

  const sets = await db.getAllAsync<SessionSet>(
    'SELECT * FROM session_set WHERE session_id = ? ORDER BY exercise_name, set_number',
    sessionId
  );

  return { session, sets };
}
