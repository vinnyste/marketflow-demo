import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ArrowLeft, Store } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.primary} />
        </Pressable>
        <Text style={s.title}>Sobre o aplicativo</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.logoSection}>
          <View style={s.logoCircle}>
            <Store size={48} color={Colors.primary} />
          </View>
          <Text style={s.appName}>MarketFlow Demo</Text>
          <Text style={s.version}>Versão 1.0.0</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Sobre nós</Text>
          <Text style={s.body}>
            O aplicativo MarketFlow Demo foi desenvolvido para oferecer comodidade aos nossos clientes,
            permitindo fazer compras online com entrega em domicílio ou retirada no estabelecimento.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>O que você pode fazer</Text>
          {[
            'Navegar e buscar produtos por categoria',
            'Adicionar itens ao carrinho e finalizar pedidos',
            'Acompanhar o status do pedido em tempo real',
            'Gerenciar seus endereços de entrega',
            'Acumular pontos e resgatar recompensas no Clube MarketFlow',
          ].map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.dot} />
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Localização</Text>
          <Text style={s.body}>
            Avenida Exemplo, 100{'\n'}Centro — Cidade Demo, Paraná
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Tecnologia</Text>
          <Text style={s.body}>
            Desenvolvido com React Native, Expo e Supabase.
            Todos os dados são armazenados com segurança e tratados conforme descrito em nossa Política de Privacidade.
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
  logoSection: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  appName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  version: { fontSize: FontSize.sm, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  body: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary, marginTop: 8, flexShrink: 0,
  },
  bulletText: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
});
