import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { getSessionHistory, deleteSession } from '../../src/db/queries';
import { exportBackup, importBackup } from '../../src/db/backup';
import { theme } from '../../src/theme/theme';
import type { WorkoutSessionWithName } from '../../src/types/models';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end + 'Z').getTime() - new Date(start + 'Z').getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSessionWithName[]>([]);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSessionHistory(db).then(setSessions);
    }, [db])
  );

  function handleDelete(session: WorkoutSessionWithName) {
    Alert.alert(
      'Supprimer la séance ?',
      `${session.template_name} — ${formatDate(session.started_at)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(db, session.id);
            setSessions((prev) => prev.filter((s) => s.id !== session.id));
          },
        },
      ]
    );
  }

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      await exportBackup(db);
    } catch (e: any) {
      Alert.alert('Erreur export', e?.message ?? 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await importBackup(db);
      if (result === null) return; // annulé
      const list = await getSessionHistory(db);
      setSessions(list);
      Alert.alert(
        'Import réussi',
        `${result.templates} entraînement${result.templates > 1 ? 's' : ''} et ${result.sessions} séance${result.sessions > 1 ? 's' : ''} importé${result.sessions > 1 ? 's' : ''}.`
      );
    } catch (e: any) {
      Alert.alert('Erreur import', e?.message ?? 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  const actionBar = (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
        onPress={handleImport}
        disabled={busy}
      >
        <Text style={styles.actionBtnText}>📥 Importer</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
        onPress={handleExport}
        disabled={busy}
      >
        <Text style={styles.actionBtnText}>📤 Exporter</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Historique' }} />

      {sessions.length === 0 ? (
        <>
          {actionBar}
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucune séance</Text>
            <Text style={styles.emptySubtitle}>
              Vos séances terminées apparaîtront ici
            </Text>
          </View>
        </>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={actionBar}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/session-detail/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{item.template_name}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.started_at)}</Text>
                  {item.finished_at && (
                    <Text style={styles.cardDuration}>
                      Durée : {formatDuration(item.started_at, item.finished_at)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  actionBar: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  cardDate: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
    textTransform: 'capitalize',
  },
  cardDuration: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  deleteBtn: {
    padding: theme.spacing.sm,
  },
  deleteIcon: {
    fontSize: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
