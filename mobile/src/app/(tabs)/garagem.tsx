import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing } from '@/theme';
import { mockGarage } from '@/data/mock-hotwheels';
import { HotWheelCard } from '@/components/hot-wheel-card';

export default function GaragemScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={mockGarage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Sua garagem</Text>
            <Text style={styles.subtitle}>
              {mockGarage.length} {mockGarage.length === 1 ? 'carro' : 'carros'} na coleção
            </Text>
          </View>
        }
        renderItem={({ item }) => <HotWheelCard item={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  listContent: { padding: spacing.lg },
  header: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.text.primary },
  subtitle: { ...typography.body, color: colors.text.secondary },
});