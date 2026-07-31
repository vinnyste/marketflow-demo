import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ArrowLeft, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.primary} />
        </Pressable>
        <Text style={s.title}>Política de Privacidade</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Esta política descreve como o MarketFlow Demo coleta, usa e protege os dados dos usuários no aplicativo.
          {'\n\n'}Última atualização: julho de 2026.
        </Text>

        <Section title="1. Dados coletados">
          <Para>Coletamos os seguintes dados fornecidos diretamente pelo usuário durante o cadastro e uso do aplicativo:</Para>
          {[
            'Nome completo',
            'Endereço de e-mail',
            'Número de celular',
            'Data de nascimento',
            'Endereços de entrega',
          ].map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.dot} />
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </Section>

        <Section title="2. Uso dos dados">
          <Para>Os dados coletados são utilizados exclusivamente para:</Para>
          {[
            'Autenticação e controle de acesso à conta',
            'Processamento e entrega de pedidos',
            'Comunicação sobre status de pedidos',
            'Cálculo e gestão de pontos do Clube MarketFlow',
            'Melhoria do serviço prestado',
          ].map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.dot} />
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </Section>

        <Section title="3. Compartilhamento de dados">
          <Para>
            Os dados dos usuários não são compartilhados, vendidos ou cedidos a terceiros, exceto quando
            necessário para a prestação do serviço (ex: processamento de pagamentos) ou por obrigação legal.
          </Para>
        </Section>

        <Section title="4. Armazenamento e segurança">
          <Para>
            Os dados são armazenados em servidores seguros providos pelo Supabase, com criptografia em
            trânsito (HTTPS/TLS) e em repouso. O acesso é restrito por políticas de segurança de linha
            (Row-Level Security).
          </Para>
        </Section>

        <Section title="5. Retenção de dados">
          <Para>
            Os dados são mantidos enquanto a conta do usuário estiver ativa. Mediante solicitação, o usuário
            pode requerer a exclusão de seus dados, salvo obrigações legais de retenção.
          </Para>
        </Section>

        <Section title="6. Direitos do usuário">
          <Para>O usuário tem direito a:</Para>
          {[
            'Acessar os dados que mantemos sobre si',
            'Solicitar correção de dados incorretos',
            'Solicitar exclusão da conta e dados associados',
          ].map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.dot} />
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
          <Para>Para exercer esses direitos, entre em contato pelo WhatsApp disponível na seção Contato.</Para>
        </Section>

        <Section title="7. Cookies e rastreamento">
          <Para>
            O aplicativo não utiliza cookies de rastreamento ou tecnologias de análise de comportamento de terceiros.
          </Para>
        </Section>

        <View style={s.placeholder}>
          <Info size={16} color={Colors.warning} />
          <Text style={s.placeholderText}>
            [Campos a completar posteriormente: CNPJ, razão social, e-mail de contato de privacidade]
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  intro: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  placeholder: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.warningSurface, borderRadius: Radius.md, padding: Spacing.md,
  },
  placeholderText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },
});
