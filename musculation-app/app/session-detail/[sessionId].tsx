import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect } from 'react';
import { getSessionDetail } from '../../src/db/queries';
import { theme } from '../../src/theme/theme';
import type { WorkoutSessionWithName, SessionSet } from '../../src/types/models';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface ExerciseGroup {
  name: string;
  sets: SessionSet[];
}

function groupByExercise(sets: SessionSet[]): ExerciseGroup[] {
  const map = new Map<string, SessionSet[]>();
  const order: string[] = [];

  for (const set of sets) {
    if (!map.has(set.exercise_name)) {
      map.set(set.exercise_name, []);
      order.push(set.exercise_name);
    }
    map.get(set.exercise_name)!.push(set);
  }

  return order.map((name) => ({ name, sets: map.get(name)! }));
}

export default function SessionDetailScreen() {
  const db = useSQLiteContext();
  const { sessionId: paramId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(paramId);

  const [session, setSession] = useState<WorkoutSessionWithName | null>(null);
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);

  useEffect(() => {
    async function load() {
      const result = await getSessionDetail(db, sessionId);
      if (result) {
        setSession(result.session);
        setExerciseGroups(groupByExercise(result.sets));
      }
    }
    load();
  }, [db, sessionId]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chargement...' }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: session.template_name }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.date}>{formatDate(session.started_at)}</Text>

        {exerciseGroups.map((group, idx) => (
          <View key={idx} style={styles.exerciseBlock}>
            <Text style={styles.exerciseName}>{group.name}</Text>
            {group.sets.map((set) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setLabel}>Série {set.set_number}</Text>
                <Text style={styles.setValue}>{set.reps} reps</Text>
                <Text style={styles.setValue}>{set.weight} kg</Text>
                {set.completed ? (
                  <Text style={styles.checkMark}>✓</Text>
                ) : (
                  <Text style={styles.skipped}>—</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
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
  date: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.lg,
    textTransform: 'capitalize',
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  setLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    width: 70,
  },
  setValue: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  checkMark: {
    color: theme.colors.success,
    fontSize: 20,
    fontWeight: '700',
    width: 30,
    textAlign: 'center',
  },
  skipped: {
    color: theme.colors.textMuted,
    fontSize: 20,
    width: 30,
    textAlign: 'center',
  },
});
