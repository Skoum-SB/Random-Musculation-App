import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { getAllTemplates, updateTemplatesOrder } from '../src/db/queries';
import { WorkoutCard } from '../src/components/WorkoutCard';
import { Button } from '../src/components/Button';
import { theme } from '../src/theme/theme';
import type { WorkoutTemplateWithMeta } from '../src/types/models';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplateWithMeta[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAllTemplates(db).then(setTemplates);
    }, [db])
  );

  async function handleReorder(data: WorkoutTemplateWithMeta[]) {
    setTemplates(data);
    await updateTemplatesOrder(db, data.map((t) => t.id));
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<WorkoutTemplateWithMeta>) {
    return (
      <ScaleDecorator>
        <WorkoutCard
          template={item}
          onStart={() =>
          Alert.alert(
            'Lancer la séance ?',
            item.name,
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'C\'est parti !', onPress: () => router.push(`/session/${item.id}`) },
            ]
          )
        }
          onEdit={() => router.push(`/template/${item.id}`)}
          onDrag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Mes Entraînements',
          headerRight: () => (
            <Text
              style={styles.historyLink}
              onPress={() => router.push('/session/history')}
            >
              Historique
            </Text>
          ),
        }}
      />

      {templates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucun entraînement</Text>
          <Text style={styles.emptySubtitle}>
            Créez votre premier entraînement pour commencer !
          </Text>
          <Button
            title="+ Nouvel Entraînement"
            onPress={() => router.push('/template/create')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </View>
      ) : (
        <>
          <DraggableFlatList
            data={templates}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            onDragEnd={({ data }) => handleReorder(data)}
            contentContainerStyle={styles.list}
          />
          <View style={styles.bottomButton}>
            <Button
              title="+ Nouvel Entraînement"
              onPress={() => router.push('/template/create')}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  bottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  historyLink: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    marginRight: theme.spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
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
