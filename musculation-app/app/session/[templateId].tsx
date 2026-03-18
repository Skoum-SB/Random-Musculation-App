import { View, Text, ScrollView, StyleSheet, Alert, BackHandler, KeyboardAvoidingView, Platform, TouchableOpacity, Vibration } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTemplateById,
  getTemplateExercises,
  getTemplateSets,
  getLastSessionSets,
  getBestPerformanceByExercise,
  createSession,
  saveSessionSets,
  finishSession,
  deleteSession,
  type LastSessionSet,
  type BestPerformance,
  type TemplateSet,
} from '../../src/db/queries';
import { SessionSetRow } from '../../src/components/SessionSetRow';
import { Button } from '../../src/components/Button';
import { theme } from '../../src/theme/theme';
import type { ActiveExercise } from '../../src/types/models';

interface RestTimer {
  remaining: number;
  total: number;
}

export default function ActiveSessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { templateId: paramId } = useLocalSearchParams<{ templateId: string }>();
  const templateId = Number(paramId);

  const [templateName, setTemplateName] = useState('');
  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const [lastByExercise, setLastByExercise] = useState<Map<string, LastSessionSet[]>>(new Map());
  const [bestByExercise, setBestByExercise] = useState<Map<string, BestPerformance>>(new Map());

  // Rest timer
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup rest timer on unmount
  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  // Load template + last session data + create new session
  useEffect(() => {
    async function init() {
      const template = await getTemplateById(db, templateId);
      if (!template) {
        router.back();
        return;
      }
      setTemplateName(template.name);

      const templateExercises = await getTemplateExercises(db, templateId);

      const [lastSets, templateSets, bestMuscu] = await Promise.all([
        getLastSessionSets(db, templateId),
        getTemplateSets(db, templateId),
        getBestPerformanceByExercise(db, templateId),
      ]);

      const lastSetsByExercise = new Map<string, LastSessionSet[]>();
      for (const set of lastSets) {
        const arr = lastSetsByExercise.get(set.exercise_name) || [];
        arr.push(set);
        lastSetsByExercise.set(set.exercise_name, arr);
      }

      const templateSetsByExId = new Map<number, TemplateSet[]>();
      for (const s of templateSets) {
        const arr = templateSetsByExId.get(s.exercise_id) || [];
        arr.push(s);
        templateSetsByExId.set(s.exercise_id, arr);
      }

      const bestMuscuMap = new Map<string, BestPerformance>();
      for (const p of bestMuscu) bestMuscuMap.set(p.exercise_name, p);

      setLastByExercise(lastSetsByExercise);
      setBestByExercise(bestMuscuMap);

      function getRestSeconds(tmplSets: TemplateSet[] | undefined, setIndex: number): number {
        if (!tmplSets || tmplSets.length === 0) return 90;
        return tmplSets[Math.min(setIndex, tmplSets.length - 1)].rest_seconds;
      }

      const initialExercises: ActiveExercise[] = templateExercises.map((exercise) => {
        const previousSets = lastSetsByExercise.get(exercise.name);
        const tmplSets = templateSetsByExId.get(exercise.id);

        if (previousSets && previousSets.length > 0) {
          return {
            name: exercise.name,
            sets: previousSets.map((s, i) => ({
              setNumber: s.set_number,
              reps: s.reps,
              weight: s.weight,
              restSeconds: getRestSeconds(tmplSets, i),
              completed: false,
            })),
          };
        }

        if (tmplSets && tmplSets.length > 0) {
          return {
            name: exercise.name,
            sets: tmplSets.map((s, i) => ({
              setNumber: i + 1,
              reps: s.reps,
              weight: s.weight,
              restSeconds: s.rest_seconds,
              completed: false,
            })),
          };
        }

        // Fallback for legacy data without template_set rows
        return {
          name: exercise.name,
          sets: Array.from({ length: exercise.default_sets }, (_, i) => ({
            setNumber: i + 1,
            reps: exercise.default_reps,
            weight: exercise.default_weight,
            restSeconds: 90,
            completed: false,
          })),
        };
      });

      setExercises(initialExercises);

      const newSessionId = await createSession(db, templateId);
      setSessionId(newSessionId);
      setLoading(false);
    }
    init();
  }, [db, templateId]);

  // Handle Android back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleAbandon();
      return true;
    });
    return () => handler.remove();
  }, [sessionId]);

  // ─── Rest timer functions ───

  function startRestTimer(seconds: number) {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTimer({ remaining: seconds, total: seconds });
    restIntervalRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          Vibration.vibrate([0, 300, 150, 300]);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }

  function skipRestTimer() {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setRestTimer(null);
  }

  // ─── Set actions ───

  function updateSet(exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      const num = parseFloat(value.replace(',', '.')) || 0;
      sets[setIndex] = { ...sets[setIndex], [field]: num };
      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function toggleSet(exerciseIndex: number, setIndex: number) {
    const currentSet = exercises[exerciseIndex]?.sets[setIndex];
    const isCompleting = currentSet && !currentSet.completed;

    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed };
      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });

    if (isCompleting && currentSet.restSeconds > 0) {
      startRestTimer(currentSet.restSeconds);
    }
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      if (exercise.sets.length <= 1) return prev;
      exercise.sets = exercise.sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function addSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const lastSet = exercise.sets[exercise.sets.length - 1];
      exercise.sets = [
        ...exercise.sets,
        {
          setNumber: exercise.sets.length + 1,
          reps: lastSet?.reps ?? 10,
          weight: lastSet?.weight ?? 0,
          restSeconds: lastSet?.restSeconds ?? 90,
          completed: false,
        },
      ];
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  const handleFinish = useCallback(async () => {
    if (sessionId === null) return;
    skipRestTimer();
    await saveSessionSets(db, sessionId, exercises.map((ex) => ({ name: ex.name, sets: ex.sets })));
    await finishSession(db, sessionId);
    router.back();
  }, [db, sessionId, exercises, router]);

  function handleAbandon() {
    Alert.alert(
      'Quitter la séance ?',
      'La séance en cours ne sera pas enregistrée.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            skipRestTimer();
            if (sessionId !== null) await deleteSession(db, sessionId);
            router.back();
          },
        },
      ]
    );
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...' }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: templateName,
          headerBackVisible: false,
          headerRight: () => (
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          restTimer ? { paddingBottom: 120 } : undefined,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.map((exercise, exIdx) => {
          const lastSetsForEx = lastByExercise.get(exercise.name);
          const bestMuscu = bestByExercise.get(exercise.name);

          const lastSummary = lastSetsForEx
            ? lastSetsForEx.map((s) => `${s.reps}×${s.weight}kg`).join('  ')
            : null;

          return (
            <View key={exIdx} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <View style={styles.statsRow}>
                {lastSummary && (
                  <View style={styles.statBadge}>
                    <Text style={styles.statLabel}>Précédente</Text>
                    <Text style={styles.statValue}>{lastSummary}</Text>
                  </View>
                )}
                {bestMuscu && (
                  <View style={[styles.statBadge, styles.statBadgeBest]}>
                    <Text style={styles.statLabel}>Record 🏆</Text>
                    <Text style={[styles.statValue, styles.statValueBest]}>
                      {bestMuscu.best_weight} kg
                    </Text>
                    <Text style={styles.statValueSub}>
                      {bestMuscu.best_reps} reps
                    </Text>
                  </View>
                )}
              </View>
              {exercise.sets.map((set, setIdx) => (
                <SessionSetRow
                  key={setIdx}
                  setNumber={set.setNumber}
                  reps={set.reps}
                  weight={set.weight}
                  completed={set.completed}
                  canRemove={exercise.sets.length > 1}
                  onUpdate={(field, value) => updateSet(exIdx, setIdx, field, value)}
                  onToggle={() => toggleSet(exIdx, setIdx)}
                  onRemove={() =>
                    Alert.alert(
                      'Supprimer la série ?',
                      `Série ${set.setNumber} — ${set.reps} reps × ${set.weight} kg`,
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Supprimer', style: 'destructive', onPress: () => removeSet(exIdx, setIdx) },
                      ]
                    )
                  }
                />
              ))}
              <Text style={styles.addSetLink} onPress={() => addSet(exIdx)}>
                + Ajouter une série
              </Text>
            </View>
          );
        })}

        <Button
          title="Terminer l'entraînement"
          onPress={handleFinish}
          style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.xl }}
        />
      </ScrollView>

      {/* Rest timer overlay */}
      {restTimer && (
        <View style={styles.restOverlay}>
          <View style={styles.restContent}>
            <Text style={styles.restLabel}>REPOS</Text>
            <Text style={styles.restCountdown}>{formatTime(restTimer.remaining)}</Text>
            <View style={styles.restProgressTrack}>
              <View
                style={[
                  styles.restProgressBar,
                  { width: `${(restTimer.remaining / restTimer.total) * 100}%` },
                ]}
              />
            </View>
            <TouchableOpacity style={styles.restSkipBtn} onPress={skipRestTimer}>
              <Text style={styles.restSkipText}>Passer →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  timer: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginRight: theme.spacing.sm,
  },
  exerciseBlock: {
    marginBottom: theme.spacing.lg,
  },
  exerciseName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  statBadge: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    flex: 1,
  },
  statBadgeBest: {
    borderWidth: 1,
    borderColor: '#b8860b',
    backgroundColor: '#1a1500',
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  statValueBest: {
    color: '#ffd700',
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
  statValueSub: {
    color: '#b8960b',
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  addSetLink: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
  },
  restOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0d1f0d',
    borderTopWidth: 2,
    borderTopColor: theme.colors.success,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  restContent: {
    alignItems: 'center',
  },
  restLabel: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  restCountdown: {
    color: theme.colors.text,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
  restProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  restProgressBar: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  restSkipBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  restSkipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
