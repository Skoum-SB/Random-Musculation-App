import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import type { WorkoutTemplateWithMeta } from '../types/models';

interface WorkoutCardProps {
  template: WorkoutTemplateWithMeta;
  onStart: () => void;
  onEdit: () => void;
  onDrag?: () => void;
  isActive?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function WorkoutCard({ template, onStart, onEdit, onDrag, isActive }: WorkoutCardProps) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {onDrag && (
        <TouchableOpacity
          style={styles.dragHandle}
          onLongPress={onDrag}
          delayLongPress={150}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.dragIcon}>⠿</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.content} onPress={onStart} activeOpacity={0.7}>
        <Text style={styles.name}>{template.name}</Text>
        <Text style={styles.meta}>
          {template.exercise_count} exercice{template.exercise_count > 1 ? 's' : ''}
        </Text>
        {template.last_session_date && (
          <Text style={styles.lastSession}>
            Dernière séance : {formatDate(template.last_session_date)}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editIcon}>✎</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#1a2a40',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    paddingRight: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dragIcon: {
    color: theme.colors.textMuted,
    fontSize: 22,
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  lastSession: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  editButton: {
    padding: theme.spacing.md,
  },
  editIcon: {
    color: theme.colors.textSecondary,
    fontSize: 22,
  },
});
