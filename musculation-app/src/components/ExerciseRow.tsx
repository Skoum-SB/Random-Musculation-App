import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import type { SetInput } from '../types/models';

interface ExerciseRowProps {
  name: string;
  sets: SetInput[];
  onUpdateName: (value: string) => void;
  onUpdateSet: (setIndex: number, field: keyof SetInput, value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onDelete: () => void;
}

export function ExerciseRow({
  name,
  sets,
  onUpdateName,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onDelete,
}: ExerciseRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={onUpdateName}
          placeholder="Nom de l'exercice"
          placeholderTextColor={theme.colors.textMuted}
        />
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.setsHeader}>
        <Text style={[styles.colLabel, styles.colNum]}>#</Text>
        <Text style={[styles.colLabel, styles.colReps]}>Reps</Text>
        <Text style={[styles.colLabel, styles.colRest]}>⏱ s</Text>
        <View style={styles.colRemove} />
      </View>

      {sets.map((s, i) => (
        <View key={i} style={styles.setRow}>
          <Text style={[styles.setNumLabel, styles.colNum]}>{i + 1}</Text>
          <TextInput
            style={[styles.numInput, styles.colReps]}
            value={String(s.reps)}
            onChangeText={(v) => onUpdateSet(i, 'reps', v)}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <TextInput
            style={[styles.numInput, styles.colRest]}
            value={String(s.restSeconds)}
            onChangeText={(v) => onUpdateSet(i, 'restSeconds', v)}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.colRemove}
            onPress={() => onRemoveSet(i)}
            disabled={sets.length <= 1}
          >
            <Text style={[styles.removeSetText, sets.length <= 1 && styles.removeSetDisabled]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Text style={styles.addSetText}>+ Série</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  nameInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  deleteBtn: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: 18,
    fontWeight: '700',
  },
  setsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  colLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  colNum: {
    width: 28,
    textAlign: 'center',
  },
  colReps: {
    flex: 1,
    textAlign: 'center',
  },
  colRest: {
    width: 52,
    textAlign: 'center',
  },
  colRemove: {
    width: 32,
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  setNumLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  numInput: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: theme.spacing.sm,
    textAlign: 'center',
  },
  removeSetText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  removeSetDisabled: {
    color: theme.colors.border,
  },
  addSetBtn: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  addSetText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
});
