import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { colors, typography, spacing } from '@/theme';
import { api } from '@/services/api';
import { HotWheelCard } from '@/components/hot-wheel-card';
import type { HotWheel } from '@/types/hot-wheel';

type GarageItem = {
  id: string;
  quantity: number;
  favorite: boolean;
  hotWheel: HotWheel;
};

export default function GaragemScreen() {
  const [items, setItems] = useState<GarageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadGarage() {
    try {
      const response = await api.get<GarageItem[]>('/my-garage');
      setItems(response.data);
    } catch {
      // por enquanto, silencioso
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

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

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
              {items.length} {items.length === 1 ? 'modelo' : 'modelos'} · {totalUnits}{' '}
              {totalUnits === 1 ? 'unidade' : 'unidades'}
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
          // Tocar no carrinho abre a Análise do Colecionador
          <Pressable
            onPress={() => router.push({ pathname: '/analise/[id]', params: { id: item.hotWheel.id } })}
            style={({ pressed }) => pressed && styles.pressed}>
            <HotWheelCard
              hotWheel={item.hotWheel}
              favorite={item.favorite}
              quantity={item.quantity}
            />
          </Pressable>
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
  pressed: { opacity: 0.7 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});