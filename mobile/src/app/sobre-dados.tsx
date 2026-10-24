import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ExternalLink } from '@/components/external-link';
import { colors, typography, spacing, borderRadius } from '@/theme';

// Endereços informados pela própria Hot Wheels Wiki (API: meta=siteinfo, rightsinfo)
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Hot_Wheels';
const LICENSE_URL = 'https://www.fandom.com/licensing';

// Créditos exigidos pela licença CC BY-SA: autoria, fonte, licença e indicação de que houve alterações
export default function SobreDadosScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Sobre os dados</Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Fonte</Text>
          <Text style={styles.text}>
            O catálogo do Hot Collection é adaptado da Hot Wheels Wiki, mantida pelos colaboradores da
            comunidade Fandom. Cada carrinho guarda o link da página da Wiki de onde veio.
          </Text>
          <ExternalLink href={WIKI_URL} style={styles.link}>
            Hot Wheels Wiki (hotwheels.fandom.com)
          </ExternalLink>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Licença</Text>
          <Text style={styles.text}>
            O conteúdo da Wiki é distribuído sob a licença Creative Commons Atribuição-CompartilhaIgual
            (CC BY-SA).
          </Text>
          <ExternalLink href={LICENSE_URL} style={styles.link}>
            Licenciamento do conteúdo da Fandom
          </ExternalLink>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>O que foi alterado</Text>
          <Text style={styles.text}>
            Os dados foram reorganizados para o app: a formatação da Wiki foi removida, números e totais de
            coleção foram separados, anos e etiquetas (Treasure Hunt, Super Treasure Hunt, exclusivos de loja
            e outras) foram padronizados, e cada variação de cor ganhou um registro próprio. Erros evidentes
            da fonte foram corrigidos com base na própria Wiki.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Marcas</Text>
          <Text style={styles.text}>
            Hot Wheels é marca registrada da Mattel. O Hot Collection não é afiliado, patrocinado nem
            endossado pela Mattel ou pela Fandom.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  container: { padding: spacing.lg, gap: spacing.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { ...typography.caption, color: colors.text.secondary },
  title: { ...typography.h2, color: colors.text.primary },
  section: {
    gap: spacing.xs,
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.md,
  },
  heading: { ...typography.bodyMedium, color: colors.text.primary },
  text: { ...typography.caption, color: colors.text.secondary, lineHeight: 20 },
  link: { ...typography.caption, color: colors.flame[500], marginTop: spacing.xs },
});
