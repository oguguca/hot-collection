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
import { router } from 'expo-router';

import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuth } from '@/contexts/auth-context';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      router.replace('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Comece sua coleção</Text>

          <TextInput
            style={styles.input}
            placeholder="Nome"
            placeholderTextColor={colors.text.disabled}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={colors.text.disabled}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Senha (mínimo 6 caracteres)"
            placeholderTextColor={colors.text.disabled}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Já tem conta? Entrar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  flex: { flex: 1 },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { ...typography.h1, color: colors.flame[600], textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    ...typography.body,
  },
  error: {
    ...typography.caption,
    color: colors.feedback.danger,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.flame[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  link: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});