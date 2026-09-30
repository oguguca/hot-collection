import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { colors, typography, spacing } from '@/theme';
import { api } from '@/services/api';
import { HotWheelCard } from '@/components/hot-wheel-card';

type GarageItem = {
  id: string;
  quantity: number;
  favorite: boolean;
  hotWheel: {
    code: string;
    name: string;
    series: string | null;
    collectionNumber: string | null;
    year: number | null;
  };
};

export default function GaragemScreen() {
  const [items, setItems] = useState<GarageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadGarage() {
    try {
      const response = await api.get('/my-garage');
      setItems(response.data);
    } catch (error) {
      // por enquanto, silencioso — poderíamos mostrar um erro visual
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadGarage();
    }, []),
  );

  function handleRefresh() {
    setRefreshing(true);
    loadGarage();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.flame[600]} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.flame[600]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Sua garagem</Text>
            <Text style={styles.subtitle}>
              {items.length} {items.length === 1 ? 'modelo' : 'modelos'} na coleção
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Você ainda não adicionou nenhum Hot Wheels. Use a aba "Adicionar" para começar.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <HotWheelCard
            item={{
              id: item.id,
              code: item.hotWheel.code,
              name: item.hotWheel.name,
              series: item.hotWheel.series ?? '',
              collectionNumber: item.hotWheel.collectionNumber ?? '',
              year: item.hotWheel.year ?? 0,
              favorite: item.favorite,
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  header: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text.primary },
  subtitle: { ...typography.body, color: colors.text.secondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});