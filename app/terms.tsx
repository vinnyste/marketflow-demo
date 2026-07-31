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

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.primary} />
        </Pressable>
        <Text style={s.title}>Termos de Uso</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Ao utilizar o aplicativo MarketFlow Demo, você concorda com os termos descritos abaixo.
          {'\n\n'}Última atualização: julho de 2026.
        </Text>

        <Section title="1. Aceitação dos termos">
          <Para>
            O uso do aplicativo implica na aceitação integral destes Termos de Uso. Caso não concorde,
            não utilize o aplicativo.
          </Para>
        </Section>

        <Section title="2. Cadastro e conta">
          <Para>
            Para utilizar o aplicativo, é necessário criar uma conta com informações verdadeiras e atualizadas.
            O usuário é responsável pela segurança de suas credenciais de acesso.
          </Para>
          <Para>
            O cadastro é permitido somente para pessoas com 18 anos ou mais, ou menores com consentimento
            de responsável legal.
          </Para>
        </Section>

        <Section title="3. Pedidos e pagamentos">
          <Para>
            Os pedidos realizados pelo aplicativo estão sujeitos à disponibilidade de estoque e ao horário
            de funcionamento da loja. O pagamento é realizado exclusivamente na entrega ou na retirada.
          </Para>
          <Para>
            Pedidos de produtos vendidos por peso (kg) terão valor estimado no momento do pedido. O valor
            final será calculado após a pesagem real pelo estabelecimento, podendo diferir do estimado.
          </Para>
        </Section>

        <Section title="4. Entrega e retirada">
          <Para>
            A entrega está disponível para bairros cadastrados conforme as zonas de entrega ativas. O prazo
            estimado pode variar conforme demanda e condições externas. A retirada no estabelecimento está
            sujeita ao horário de atendimento.
          </Para>
        </Section>

        <Section title="5. Clube MarketFlow">
          <Para>
            Os pontos acumulados no Clube MarketFlow não possuem valor monetário e não podem ser transferidos
            ou convertidos em dinheiro. O MarketFlow Demo reserva-se o direito de alterar as regras do
            programa a qualquer momento, mediante aviso prévio no aplicativo.
          </Para>
        </Section>

        <Section title="6. Cancelamentos">
          <Para>
            O cancelamento de pedidos está sujeito ao status atual. Pedidos já em preparação, pesagem ou
            entrega podem não ser cancelados. Em caso de dúvidas, entre em contato pelo WhatsApp.
          </Para>
        </Section>

        <Section title="7. Limitação de responsabilidade">
          <Para>
            O MarketFlow Demo não se responsabiliza por falhas de conectividade ou indisponibilidade
            temporária do aplicativo causadas por terceiros (operadoras, provedores de nuvem, etc.).
          </Para>
        </Section>

        <Section title="8. Alterações nos termos">
          <Para>
            Estes termos podem ser atualizados periodicamente. Notificações sobre mudanças significativas
            serão exibidas no aplicativo. O uso continuado após as alterações implica aceitação.
          </Para>
        </Section>

        <View style={s.placeholder}>
          <Info size={16} color={Colors.warning} />
          <Text style={s.placeholderText}>
            [Campos a completar posteriormente: razão social, CNPJ, foro de eleição]
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
  placeholder: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.warningSurface, borderRadius: Radius.md, padding: Spacing.md,
  },
  placeholderText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 18 },
});
