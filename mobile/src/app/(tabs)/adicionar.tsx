import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

type SearchState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

export default function AdicionarScreen() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<HotWheel[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  async function handleSearch() {
    if (!code.trim()) return;

    setState('loading');
    setAddedIds([]);
    setAddError('');

    try {
      const response = await api.get(`/hot-wheels/code/${encodeURIComponent(code.trim())}`);
      if (response.data.found) {
        setResults(response.data.items);
        setState('found');
      } else {
        setResults([]);
        setState('not-found');
      }
    } catch {
      setState('error');
    }
  }

  async function handleAddToGarage(item: HotWheel) {
    setAddingId(item.id);
    setAddError('');
    try {
      await api.post('/my-garage', { hotWheelId: item.id });
      setAddedIds((current) => [...current, item.id]);
    } catch {
      setAddError('Não foi possível adicionar. Tente de novo.');
    } finally {
      setAddingId(null);
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

          {state === 'error' && (
            <View style={[styles.feedback, styles.feedbackCard]}>
              <Ionicons name="cloud-offline" size={24} color={colors.feedback.danger} />
              <Text style={styles.feedbackText}>
                Não foi possível consultar o catálogo. Verifique sua conexão e tente de novo.
              </Text>
            </View>
          )}

          {state === 'found' && (
            <FlatList
              style={styles.list}
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                results.length > 1 ? (
                  <Text style={styles.multiple}>
                    Esse código aparece em {results.length} carrinhos. Escolha o seu:
                  </Text>
                ) : null
              }
              ListFooterComponent={
                addError !== '' ? <Text style={styles.error}>{addError}</Text> : null
              }
              renderItem={({ item }) => {
                const added = addedIds.includes(item.id);
                const adding = addingId === item.id;

                return (
                  <View style={styles.resultBlock}>
                    <HotWheelCard hotWheel={item} />

                    {added ? (
                      <View style={styles.addedRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.feedback.success}
                        />
                        <Text style={styles.addedText}>Adicionado à garagem!</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.addButton}
                        onPress={() => handleAddToGarage(item)}
                        disabled={adding}>
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
                  </View>
                );
              }}
            />
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
  list: {
    marginTop: spacing.lg,
  },
  multiple: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  resultBlock: {
    marginBottom: spacing.md,
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