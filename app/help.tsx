import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { ArrowLeft, ChevronDown, ChevronUp, MessageCircle, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

const WHATSAPP_URL = 'https://wa.me/5500000000000';

const FAQ = [
  {
    q: 'Como acompanho meu pedido?',
    a: 'Acesse a aba "Pedidos" no menu inferior. Você verá o status atualizado em tempo real para cada pedido.',
  },
  {
    q: 'Como funciona a entrega por peso (kg)?',
    a: 'Para produtos vendidos por kg, o valor exibido no pedido é estimado. Após a pesagem no estabelecimento, o valor final será atualizado e você será notificado.',
  },
  {
    q: 'Posso cancelar um pedido?',
    a: 'Pedidos com status "Pendente" podem ser cancelados. Para outros status, entre em contato pelo WhatsApp.',
  },
  {
    q: 'O que é o Clube MarketFlow?',
    a: 'É o programa de pontos do MarketFlow Demo. A cada compra concluída você acumula pontos que podem ser trocados por descontos e benefícios.',
  },
  {
    q: 'Como adicionar um endereço de entrega?',
    a: 'Acesse "Perfil" > "Meus endereços" > "Adicionar endereço". Informe o CEP para preenchimento automático.',
  },
  {
    q: 'Quais formas de pagamento são aceitas?',
    a: 'Dinheiro, PIX, cartão de débito, cartão de crédito e cartão-alimentação. O pagamento é feito na entrega ou na retirada.',
  },
  {
    q: 'Minha área tem entrega disponível?',
    a: 'A entrega está disponível em bairros cadastrados. Você verá a taxa de entrega ao selecionar seu endereço no checkout.',
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = React.useState<number | null>(null);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.primary} />
        </Pressable>
        <Text style={s.title}>Ajuda</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionHeader}>Perguntas frequentes</Text>

        {FAQ.map((item, i) => (
          <Pressable
            key={i}
            style={s.faqCard}
            onPress={() => setExpanded(expanded === i ? null : i)}
          >
            <View style={s.faqTop}>
              <Text style={s.faqQ}>{item.q}</Text>
              {expanded === i ? <ChevronUp size={22} color={Colors.primary} /> : <ChevronDown size={22} color={Colors.primary} />}
            </View>
            {expanded === i ? (
              <Text style={s.faqA}>{item.a}</Text>
            ) : null}
          </Pressable>
        ))}

        <Text style={s.sectionHeader}>Ainda precisa de ajuda?</Text>

        <Pressable
          style={({ pressed }) => [s.whatsappBtn, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(WHATSAPP_URL)}
        >
          <View style={s.whatsappIcon}>
            <MessageCircle size={22} color="#fff" />
          </View>
          <Text style={s.whatsappText}>Falar com o suporte via WhatsApp</Text>
          <ExternalLink size={16} color="#fff" style={{ marginLeft: 'auto' as any }} />
        </Pressable>
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
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  sectionHeader: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm,
  },
  faqCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  faqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  faqQ: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, lineHeight: 22 },
  faqA: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#25D366', borderRadius: Radius.lg, padding: Spacing.lg,
    marginTop: Spacing.sm, ...Shadow.sm,
  },
  whatsappIcon: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  whatsappText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff', flex: 1 },
});
