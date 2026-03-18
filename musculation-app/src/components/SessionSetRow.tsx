import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { DecimalInput } from './DecimalInput';

interface SessionSetRowProps {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  canRemove: boolean;
  onUpdate: (field: 'reps' | 'weight', value: string) => void;
  onToggle: () => void;
  onRemove: () => void;
}

export function SessionSetRow({ setNumber, reps, weight, completed, canRemove, onUpdate, onToggle, onRemove }: SessionSetRowProps) {
  return (
    <View style={[styles.container, completed && styles.completedContainer]}>
      <Text style={styles.setLabel}>Série {setNumber}</Text>

      <View style={styles.inputGroup}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Reps</Text>
          <TextInput
            style={styles.input}
            value={String(reps)}
            onChangeText={(v) => onUpdate('reps', v)}
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>kg</Text>
          <DecimalInput
            style={styles.input}
            value={weight}
            onChange={(v) => onUpdate('weight', v)}
            selectTextOnFocus
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.checkBtn, completed && styles.checkBtnDone]}
        onPress={onToggle}
      >
        <Text style={styles.checkText}>{completed ? '✓' : ''}</Text>
      </TouchableOpacity>

      {canRemove && (
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Text style={styles.removeText}>−</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  completedContainer: {
    opacity: 0.6,
  },
  setLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    width: 60,
    fontWeight: '600',
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  inputLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  input: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    textAlign: 'center',
    width: '100%',
  },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  checkBtnDone: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  checkText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  removeText: {
    color: theme.colors.danger,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
