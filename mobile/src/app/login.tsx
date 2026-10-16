import { useState } from 'react';
   import * as Linking from 'expo-linking';
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
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuth } from '@/contexts/auth-context';

const API_BASE_URL = 'http://10.0.2.2:3000';

export default function LoginScreen() {
  const { login, loginWithGoogleData } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível fazer login.');
    } finally {
      setLoading(false);
    }
  }

    async function handleGoogleLogin() {
    setError('');
    setGoogleLoading(true);
    try {
      // No Expo Go gera um endereço exp://..., num build nativo gera hotcollectionapp://...
      const redirectUrl = Linking.createURL('auth-callback');
      const authUrl = `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);
        const accessToken = queryParams?.accessToken;
        const id = queryParams?.userId;
        const userEmail = queryParams?.email;
        const name = queryParams?.name;

        if (
          typeof accessToken === 'string' &&
          typeof id === 'string' &&
          typeof userEmail === 'string'
        ) {
          await loginWithGoogleData({
            accessToken,
            id,
            email: userEmail,
            name: typeof name === 'string' ? name : '',
          });
          router.replace('/');
        } else {
          setError('Não foi possível completar o login com Google.');
        }
      }
    } catch (err) {
      setError('Não foi possível completar o login com Google.');
    } finally {
      setGoogleLoading(false);
    }
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>HOT COLLECTION</Text>
          <Text style={styles.subtitle}>Entre na sua garagem</Text>

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
            placeholder="Senha"
            placeholderTextColor={colors.text.disabled}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error !== '' && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.text.primary} />
                <Text style={styles.googleButtonText}>Entrar com Google</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.link}>Não tem conta? Cadastre-se</Text>
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.background[500],
  },
  dividerText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background[700],
    borderWidth: 1,
    borderColor: colors.background[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  googleButtonText: {
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