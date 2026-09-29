import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { mockGarage } from '@/data/mock-hotwheels';

type SearchState = 'idle' | 'loading' | 'found' | 'not-found';

export default function AdicionarScreen() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<SearchState>('idle');

  function handleSearch() {
    if (!code.trim()) return;

    setState('loading');

    // Simulação — na Fase 9 isso vira uma chamada real à API
    setTimeout(() => {
      const normalized = code.trim().toUpperCase();
      if (normalized === 'HYY04-N7C6') {
        setState('found');
      } else {
        setState('not-found');
      }
    }, 1000);
  }

  const result = mockGarage[0]; // usado só quando state === 'found'

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Adicionar Hot Wheels</Text>
          <Text style={styles.subtitle}>Digite o código da embalagem para buscar.</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ex: HYY04-N7C6"
              placeholderTextColor={colors.text.disabled}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable style={styles.searchButton} onPress={handleSearch}>
              <Ionicons name="search" size={20} color={colors.text.primary} />
            </Pressable>
          </View>

          {state === 'loading' && (
            <View style={styles.feedback}>
              <ActivityIndicator color={colors.flame[600]} />
              <Text style={styles.feedbackText}>Buscando no catálogo...</Text>
            </View>
          )}

          {state === 'not-found' && (
            <View style={[styles.feedback, styles.feedbackCard]}>
              <Ionicons name="alert-circle" size={24} color={colors.feedback.warning} />
              <Text style={styles.feedbackText}>
                Não encontramos esse Hot Wheels no catálogo.
              </Text>
            </View>
          )}

          {state === 'found' && (
            <View style={[styles.resultCard, shadow.card]}>
              <View style={styles.imagePlaceholder}>
                <Ionicons name="car-sport" size={32} color={colors.chrome[500]} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultCode}>{result.code}</Text>
                <Text style={styles.resultSeries}>
                  {result.series} · {result.collectionNumber}
                </Text>
              </View>
              <Pressable style={styles.addButton}>
                <Ionicons name="add" size={18} color={colors.text.primary} />
                <Text style={styles.addButtonText}>Adicionar à garagem</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  flex: { flex: 1 },
  container: { flex: 1, padding: spacing.lg },
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    paddingHorizontal: spacing.md,
    color: colors.text.primary,
    ...typography.body,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.flame[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  feedbackCard: {
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  feedbackText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  resultCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.md,
    gap: spacing.sm,
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { gap: 2 },
  resultName: { ...typography.bodyMedium, color: colors.text.primary },
  resultCode: { ...typography.caption, color: colors.text.disabled },
  resultSeries: { ...typography.caption, color: colors.text.secondary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.flame[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
});