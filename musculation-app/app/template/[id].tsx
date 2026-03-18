import { View, Text, TextInput, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect } from 'react';
import {
  getTemplateById,
  getTemplateExercises,
  getTemplateSets,
  updateTemplate,
  deleteTemplate,
  type ExerciseInput,
} from '../../src/db/queries';
import { ExerciseRow } from '../../src/components/ExerciseRow';
import { Button } from '../../src/components/Button';
import { theme } from '../../src/theme/theme';
import type { SetInput } from '../../src/types/models';

interface ExerciseForm {
  name: string;
  sets: SetInput[];
}

function defaultSet(): SetInput {
  return { reps: 10, weight: 0, restSeconds: 90 };
}

function defaultExercise(): ExerciseForm {
  return { name: '', sets: [defaultSet()] };
}

export default function EditTemplateScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<ExerciseForm[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const template = await getTemplateById(db, templateId);
      if (!template) {
        router.back();
        return;
      }
      setName(template.name);

      const exs = await getTemplateExercises(db, templateId);
      const allSets = await getTemplateSets(db, templateId);

      const setsByExId = new Map<number, SetInput[]>();
      for (const s of allSets) {
        const arr = setsByExId.get(s.exercise_id) ?? [];
        arr.push({
          reps: s.reps,
          weight: s.weight,
          restSeconds: s.rest_seconds ?? 90,
        });
        setsByExId.set(s.exercise_id, arr);
      }

      setExercises(
        exs.map((e) => {
          const sets = setsByExId.get(e.id);
          return {
            name: e.name,
            sets: sets && sets.length > 0 ? sets : [defaultSet()],
          };
        })
      );
      setLoaded(true);
    }
    load();
  }, [db, templateId]);

  function updateExerciseName(exerciseIndex: number, value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex] = { ...updated[exerciseIndex], name: value };
      return updated;
    });
  }

  function updateExerciseSet(exerciseIndex: number, setIndex: number, field: keyof SetInput, value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const sets = [...exercise.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: parseFloat(value.replace(',', '.')) || 0 };
      exercise.sets = sets;
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function addExerciseSet(exerciseIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      const lastSet = exercise.sets[exercise.sets.length - 1] ?? defaultSet();
      exercise.sets = [...exercise.sets, { ...lastSet }];
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function removeExerciseSet(exerciseIndex: number, setIndex: number) {
    setExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exerciseIndex] };
      if (exercise.sets.length <= 1) return prev;
      exercise.sets = exercise.sets.filter((_, i) => i !== setIndex);
      updated[exerciseIndex] = exercise;
      return updated;
    });
  }

  function removeExercise(index: number) {
    if (exercises.length <= 1) return;
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function addExercise() {
    setExercises((prev) => [...prev, defaultExercise()]);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Erreur', "Veuillez donner un nom à l'entraînement");
      return;
    }
    const validExercises = exercises.filter((e) => e.name.trim());
    if (validExercises.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un exercice');
      return;
    }

    const input: ExerciseInput[] = validExercises.map((e) => ({
      name: e.name.trim(),
      sets: e.sets,
    }));

    try {
      await updateTemplate(db, templateId, name.trim(), input);
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Une erreur est survenue');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Supprimer',
      'Supprimer cet entraînement et tout son historique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteTemplate(db, templateId);
            router.back();
          },
        },
      ]
    );
  }

  if (!loaded) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Modifier' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Nom de l'entraînement"
          placeholderTextColor={theme.colors.textMuted}
        />

        {exercises.map((ex, i) => (
          <ExerciseRow
            key={i}
            name={ex.name}
            sets={ex.sets}
            onUpdateName={(v) => updateExerciseName(i, v)}
            onUpdateSet={(setIdx, field, value) => updateExerciseSet(i, setIdx, field, value)}
            onAddSet={() => addExerciseSet(i)}
            onRemoveSet={(setIdx) => removeExerciseSet(i, setIdx)}
            onDelete={() => removeExercise(i)}
          />
        ))}

        <Button
          title="+ Ajouter un exercice"
          variant="secondary"
          onPress={addExercise}
          style={{ marginBottom: theme.spacing.lg }}
        />

        <Button title="Enregistrer" onPress={handleSave} />
        <Button
          title="Supprimer l'entraînement"
          variant="danger"
          onPress={handleDelete}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
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
  nameInput: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
});
