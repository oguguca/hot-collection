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

import { colors, typography, spacing, borderRadius } from '@/theme';
import { api } from '@/services/api';
import { HotWheelCard } from '@/components/hot-wheel-card';
import type { HotWheel } from '@/types/hot-wheel';

type SearchState = 'idle' | 'loading' | 'found' | 'not-found';

export default function AdicionarScreen() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [result, setResult] = useState<HotWheel | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleSearch() {
    if (!code.trim()) return;

    setState('loading');
    setAdded(false);
    setAddError('');

    try {
      const response = await api.get(`/hot-wheels/code/${encodeURIComponent(code.trim())}`);
      if (response.data.found) {
        setResult(response.data.data);
        setState('found');
      } else {
        setState('not-found');
      }
    } catch {
      setState('not-found');
    }
  }

  async function handleAddToGarage() {
    if (!result) return;

    setAdding(true);
    setAddError('');
    try {
      await api.post('/my-garage', { hotWheelCode: result.code });
      setAdded(true);
    } catch {
      setAddError('Não foi possível adicionar. Tente de novo.');
    } finally {
      setAdding(false);
    }
  }

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
              placeholder="Ex: HKC37"
              placeholderTextColor={colors.text.disabled}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
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

          {state === 'found' && result && (
            <View style={styles.resultBlock}>
              <HotWheelCard hotWheel={result} />

              {added ? (
                <View style={styles.addedRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.feedback.success} />
                  <Text style={styles.addedText}>Adicionado à garagem!</Text>
                </View>
              ) : (
                <Pressable style={styles.addButton} onPress={handleAddToGarage} disabled={adding}>
                  {adding ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <>
                      <Ionicons name="add" size={18} color={colors.text.primary} />
                      <Text style={styles.addButtonText}>Adicionar à garagem</Text>
                    </>
                  )}
                </Pressable>
              )}

              {addError !== '' && <Text style={styles.error}>{addError}</Text>}
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
  resultBlock: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.flame[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addedText: {
    ...typography.bodyMedium,
    color: colors.feedback.success,
  },
  error: {
    ...typography.caption,
    color: colors.feedback.danger,
    textAlign: 'center',
  },
});