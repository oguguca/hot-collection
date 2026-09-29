import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing } from '@/theme';
import { api } from '@/services/api';

export default function HomeScreen() {
  const [status, setStatus] = useState('Testando conexão...');

  useEffect(() => {
    api
      .get('/health')
      .then((response) => {
        setStatus(`Conectado! Total checks: ${response.data.totalChecks}`);
      })
      .catch((error) => {
        setStatus(`Erro: ${error.message}`);
      });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>HOT COLLECTION</Text>
        <Text style={styles.subtitle}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  container: { flex: 1, padding: spacing.lg },
  title: { ...typography.h1, color: colors.flame[600], marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.text.secondary },
});