import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

// ─── Types ───

interface BackupTemplateSet {
  set_number: number;
  reps: number;
  weight: number;
  rest_seconds: number;
}

interface BackupExercise {
  name: string;
  sort_order: number;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  template_sets: BackupTemplateSet[];
}

interface BackupSessionSet {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number;
  completed: number;
}

interface BackupSession {
  started_at: string;
  finished_at: string | null;
  session_sets: BackupSessionSet[];
}

interface BackupTemplate {
  name: string;
  created_at: string;
  updated_at: string;
  exercises: BackupExercise[];
  sessions: BackupSession[];
}

interface BackupData {
  version: number;
  exported_at: string;
  templates: BackupTemplate[];
}

// ─── Export ───

export async function exportBackup(db: SQLiteDatabase): Promise<void> {
  const templates = await db.getAllAsync<{
    id: number; name: string; created_at: string; updated_at: string;
  }>('SELECT id, name, created_at, updated_at FROM workout_template ORDER BY created_at');

  const backupTemplates: BackupTemplate[] = [];

  for (const t of templates) {
    const exercises = await db.getAllAsync<{
      id: number; name: string; sort_order: number;
      default_sets: number; default_reps: number; default_weight: number;
    }>('SELECT id, name, sort_order, default_sets, default_reps, default_weight FROM template_exercise WHERE template_id = ? ORDER BY sort_order', t.id);

    const backupExercises: BackupExercise[] = [];
    for (const e of exercises) {
      const sets = await db.getAllAsync<BackupTemplateSet>(
        'SELECT set_number, reps, weight, rest_seconds FROM template_set WHERE exercise_id = ? ORDER BY set_number',
        e.id
      );
      backupExercises.push({
        name: e.name,
        sort_order: e.sort_order,
        default_sets: e.default_sets,
        default_reps: e.default_reps,
        default_weight: e.default_weight,
        template_sets: sets,
      });
    }

    const sessions = await db.getAllAsync<{ id: number; started_at: string; finished_at: string | null }>(
      'SELECT id, started_at, finished_at FROM workout_session WHERE template_id = ? ORDER BY started_at',
      t.id
    );

    const backupSessions: BackupSession[] = [];
    for (const s of sessions) {
      const sessionSets = await db.getAllAsync<BackupSessionSet>(
        'SELECT exercise_name, set_number, reps, weight, completed FROM session_set WHERE session_id = ? ORDER BY exercise_name, set_number',
        s.id
      );
      backupSessions.push({
        started_at: s.started_at,
        finished_at: s.finished_at,
        session_sets: sessionSets,
      });
    }

    backupTemplates.push({
      name: t.name,
      created_at: t.created_at,
      updated_at: t.updated_at,
      exercises: backupExercises,
      sessions: backupSessions,
    });
  }

  const backup: BackupData = {
    version: 2,
    exported_at: new Date().toISOString(),
    templates: backupTemplates,
  };

  const date = new Date().toISOString().split('T')[0];
  const fileUri = `${FileSystem.documentDirectory}RAM_backup_${date}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Exporter les données R.A.M',
    });
  }
}

// ─── Import ───

export interface ImportResult {
  templates: number;
  sessions: number;
}

export async function importBackup(db: SQLiteDatabase): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const json = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let data: BackupData;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Fichier JSON invalide');
  }

  if (!data.version || !Array.isArray(data.templates)) {
    throw new Error('Format de fichier non reconnu');
  }

  let importedTemplates = 0;
  let importedSessions = 0;

  await db.withTransactionAsync(async () => {
    for (const t of data.templates) {
      const tResult = await db.runAsync(
        'INSERT INTO workout_template (name, created_at, updated_at) VALUES (?, ?, ?)',
        t.name,
        t.created_at ?? new Date().toISOString(),
        t.updated_at ?? new Date().toISOString()
      );
      const newTemplateId = Number(tResult.lastInsertRowId);
      importedTemplates++;

      for (let i = 0; i < (t.exercises ?? []).length; i++) {
        const e = t.exercises[i];
        const eResult = await db.runAsync(
          `INSERT INTO template_exercise
            (template_id, name, default_sets, default_reps, default_weight, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          newTemplateId, e.name,
          e.default_sets ?? e.template_sets?.length ?? 1,
          e.default_reps ?? 0, e.default_weight ?? 0,
          e.sort_order ?? i
        );
        const newExerciseId = Number(eResult.lastInsertRowId);

        for (const s of (e.template_sets ?? [])) {
          await db.runAsync(
            'INSERT INTO template_set (exercise_id, set_number, reps, weight, rest_seconds) VALUES (?, ?, ?, ?, ?)',
            newExerciseId, s.set_number,
            s.reps ?? 0, s.weight ?? 0, s.rest_seconds ?? 90
          );
        }
      }

      for (const s of (t.sessions ?? [])) {
        const sResult = await db.runAsync(
          'INSERT INTO workout_session (template_id, started_at, finished_at) VALUES (?, ?, ?)',
          newTemplateId, s.started_at, s.finished_at
        );
        const newSessionId = Number(sResult.lastInsertRowId);
        importedSessions++;

        for (const set of (s.session_sets ?? [])) {
          await db.runAsync(
            `INSERT INTO session_set
              (session_id, exercise_name, set_number, reps, weight, completed)
             VALUES (?, ?, ?, ?, ?, ?)`,
            newSessionId, set.exercise_name, set.set_number,
            set.reps ?? 0, set.weight ?? 0, set.completed ?? 1
          );
        }
      }
    }
  });

  return { templates: importedTemplates, sessions: importedSessions };
}
