import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Info, Gift, Tag, History, PlusCircle, MinusCircle, SlidersHorizontal, CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useLoyalty } from '@/hooks/useLoyalty';
import { useAuth } from '@/hooks/useAuth';
import { loyaltyService } from '@/services/loyalty';
import { settingsService } from '@/services/settings';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';
import { LoyaltyReward, LoyaltyRewardType } from '@/types/database';

type Section = 'history' | 'rewards' | 'coupons';

type TxCfg = { Icon: any; color: string };
const TYPE_CONFIG: Record<string, TxCfg> = {
  earn:       { Icon: PlusCircle,        color: Colors.success },
  redeem:     { Icon: MinusCircle,       color: Colors.error },
  adjustment: { Icon: SlidersHorizontal, color: Colors.warning },
};

const REWARD_TYPE_ICONS: Record<LoyaltyRewardType, any> = {
  discount_flat:    Tag,
  discount_percent: Tag,
  free_product:     Gift,
  custom:           Star,
};

const REWARD_TYPE_LABELS: Record<LoyaltyRewardType, string> = {
  discount_flat: 'Desconto em R$',
  discount_percent: 'Desconto em %',
  free_product: 'Produto grátis',
  custom: 'Benefício',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: 'Ativo',    color: Colors.success,  bg: Colors.successSurface },
  used:    { label: 'Usado',    color: Colors.textMuted, bg: Colors.borderLight },
  expired: { label: 'Expirado', color: Colors.error,    bg: Colors.errorSurface },
};

export default function LoyaltyScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { account, transactions, rewards, redemptions, isLoading, refresh } = useLoyalty();
  const [section, setSection] = useState<Section>('rewards');
  const [redeemModal, setRedeemModal] = useState<LoyaltyReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    coupon_code: string; reward_name: string; expires_at: string;
  } | null>(null);
  const [loyaltyRule, setLoyaltyRule] = useState<string | null>(null);

  React.useEffect(() => {
    settingsService.getAll().then((settings) => {
      const m: Record<string, string> = {};
      settings.forEach((s) => { m[s.key] = s.value; });
      if (m['loyalty_enabled'] !== 'true') { setLoyaltyRule(null); return; }
      if (m['loyalty_mode'] === 'per_order') {
        setLoyaltyRule(`A cada pedido concluído você ganha ${m['loyalty_points_per_order'] || '10'} pontos.`);
      } else {
        const brl = m['loyalty_brl_per_point'] || '1';
        setLoyaltyRule(`A cada R$ ${brl},00 em compras você ganha 1 ponto.`);
      }
    });
  }, []);

  const handleRedeem = async () => {
    if (!redeemModal || !user) return;
    setRedeeming(true);
    try {
      const result = await loyaltyService.redeemReward(user.id, redeemModal.id);
      setRedeemModal(null);
      setSuccessModal(result);
      await refresh();
    } catch (e: any) {
      Alert.alert('Erro no resgate', e.message || 'Não foi possível resgatar a recompensa.');
    } finally {
      setRedeeming(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Clube MarketFlow</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Star size={56} color={Colors.primary} />
          <Text style={styles.loginTitle}>Faça login para ver seus pontos</Text>
          <Text style={styles.loginSub}>Acumule pontos a cada compra e troque por benefícios.</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
            <Text style={styles.loginBtnText}>Entrar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando pontos..." />;

  const balance = account?.points_balance ?? 0;
  const SECTIONS: { key: Section; label: string; count?: number }[] = [
    { key: 'rewards', label: 'Recompensas', count: rewards.length },
    { key: 'coupons', label: 'Meus cupons', count: redemptions.filter((r) => r.status === 'active').length },
    { key: 'history', label: 'Histórico' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Clube MarketFlow</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceGreeting}>
                Olá, {profile?.full_name?.split(' ')[0] || 'Cliente'}!
              </Text>
              <Text style={styles.balanceLabel}>Saldo de pontos</Text>
            </View>
            <Star size={40} color={Colors.primary} />
          </View>
          <Text style={styles.balancePoints}>{balance.toLocaleString('pt-BR')}</Text>
          <Text style={styles.balancePts}>pontos</Text>
          {loyaltyRule ? (
            <View style={styles.ruleTag}>
              <Info size={13} color={Colors.primary} />
              <Text style={styles.ruleText}>{loyaltyRule}</Text>
            </View>
          ) : null}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={18} color={i <= Math.min(5, Math.floor(balance / 100)) ? Colors.primary : Colors.border} />
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Info size={15} color={Colors.info} />
          <Text style={styles.infoText}>
            Pontos são liberados após a conclusão do pedido. Pedidos cancelados não geram pontos.
          </Text>
        </View>

        {/* Section tabs */}
        <View style={styles.sectionTabs}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.sectionTab, section === s.key && styles.sectionTabActive]}
              onPress={() => setSection(s.key)}
            >
              <Text style={[styles.sectionTabText, section === s.key && styles.sectionTabTextActive]}>
                {s.label}{s.count != null ? ` (${s.count})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Rewards */}
        {section === 'rewards' ? (
          rewards.length === 0 ? (
            <View style={styles.empty}>
              <Gift size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma recompensa disponível</Text>
              <Text style={styles.emptySub}>Fique de olho! Novas recompensas serão adicionadas em breve.</Text>
            </View>
          ) : (
            rewards.map((r) => {
              const canRedeem = balance >= r.points_required;
              const RewardIcon = REWARD_TYPE_ICONS[r.reward_type];
              return (
                <View key={r.id} style={[styles.rewardCard, !canRedeem && styles.rewardCardLocked]}>
                  <View style={styles.rewardTop}>
                    <View style={[styles.rewardIcon, { backgroundColor: Colors.primary + '18' }]}>
                      <RewardIcon size={22} color={canRedeem ? Colors.primary : Colors.textMuted} />
                    </View>
                    <View style={styles.rewardInfo}>
                      <Text style={[styles.rewardName, !canRedeem && styles.textMuted]}>{r.name}</Text>
                      <Text style={styles.rewardType}>{REWARD_TYPE_LABELS[r.reward_type]}</Text>
                    </View>
                    <View style={[styles.ptsNeeded, canRedeem ? styles.ptsNeededCan : styles.ptsNeededCant]}>
                      <Text style={[styles.ptsNeededText, canRedeem ? styles.ptsNeededTextCan : styles.ptsNeededTextCant]}>
                        {r.points_required} pts
                      </Text>
                    </View>
                  </View>
                  {r.description ? <Text style={styles.rewardDesc}>{r.description}</Text> : null}
                  {r.reward_value != null ? (
                    <Text style={styles.rewardValue}>
                      {r.reward_type === 'discount_percent'
                        ? `${r.reward_value}% de desconto`
                        : `R$ ${r.reward_value.toFixed(2).replace('.', ',')} de desconto`}
                    </Text>
                  ) : null}
                  {r.quantity_available != null && r.quantity_available <= 5 ? (
                    <Text style={styles.quantityWarn}>Apenas {r.quantity_available} disponível(is)!</Text>
                  ) : null}
                  <Pressable
                    style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]}
                    onPress={() => canRedeem ? setRedeemModal(r) : null}
                    disabled={!canRedeem}
                  >
                    <Text style={[styles.redeemBtnText, !canRedeem && styles.redeemBtnTextDisabled]}>
                      {canRedeem ? 'Resgatar' : `Faltam ${r.points_required - balance} pts`}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )
        ) : null}

        {/* Coupons */}
        {section === 'coupons' ? (
          redemptions.length === 0 ? (
            <View style={styles.empty}>
              <Tag size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum cupom ainda</Text>
              <Text style={styles.emptySub}>Resgate recompensas para gerar seus cupons.</Text>
            </View>
          ) : (
            redemptions.map((red) => {
              const st = STATUS_CONFIG[red.status] ?? STATUS_CONFIG['active'];
              return (
                <View key={red.id} style={[styles.couponCard, red.status !== 'active' && styles.couponUsed]}>
                  <View style={styles.couponTop}>
                    <View style={styles.couponLeft}>
                      <Text style={styles.couponName}>{red.reward?.name || 'Recompensa'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <View style={styles.couponRight}>
                      <Text style={styles.couponCode}>{red.coupon_code}</Text>
                      <Text style={styles.couponPts}>{red.points_spent} pts usados</Text>
                    </View>
                  </View>
                  {red.expires_at ? (
                    <Text style={styles.couponExpiry}>
                      {red.status === 'active'
                        ? `Válido até ${new Date(red.expires_at).toLocaleDateString('pt-BR')}`
                        : `Expirou em ${new Date(red.expires_at).toLocaleDateString('pt-BR')}`}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )
        ) : null}

        {/* History */}
        {section === 'history' ? (
          transactions.length === 0 ? (
            <View style={styles.empty}>
              <History size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma movimentação ainda</Text>
              <Text style={styles.emptySub}>Seus pontos aparecerão aqui após o primeiro pedido.</Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const cfg = TYPE_CONFIG[tx.type] ?? TYPE_CONFIG['earn'];
              const sign = tx.type === 'earn' ? '+' : tx.type === 'redeem' ? '−' : tx.points >= 0 ? '+' : '';
              const abs = Math.abs(tx.points);
              const date = new Date(tx.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              });
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: cfg.color + '22' }]}>
                    <cfg.Icon size={20} color={cfg.color} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDesc} numberOfLines={2}>{tx.description}</Text>
                    <Text style={styles.txDate}>{date}</Text>
                  </View>
                  <Text style={[styles.txPoints, { color: cfg.color }]}>
                    {sign}{abs} pt{abs !== 1 ? 's' : ''}
                  </Text>
                </View>
              );
            })
          )
        ) : null}
      </ScrollView>

      {/* Redeem modal */}
      <Modal visible={!!redeemModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Gift size={32} color={Colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>Confirmar resgate</Text>
            <Text style={styles.modalReward}>{redeemModal?.name}</Text>
            <Text style={styles.modalSub}>
              Você usará{' '}
              <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>{redeemModal?.points_required} pontos</Text>
              {' '}do seu saldo de{' '}
              <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>{balance} pontos</Text>.
            </Text>
            <Text style={styles.modalSub}>Saldo restante: {balance - (redeemModal?.points_required ?? 0)} pts</Text>
            <View style={styles.modalBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setRedeemModal(null)} />
              <Button label="Resgatar" onPress={handleRedeem} loading={redeeming} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal visible={!!successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <CheckCircle size={48} color={Colors.success} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>Resgate realizado!</Text>
            <Text style={styles.modalReward}>{successModal?.reward_name}</Text>
            <View style={styles.couponBig}>
              <Text style={styles.couponBigLabel}>Seu cupom</Text>
              <Text style={styles.couponBigCode}>{successModal?.coupon_code}</Text>
            </View>
            {successModal?.expires_at ? (
              <Text style={styles.modalSub}>
                Válido até {new Date(successModal.expires_at).toLocaleDateString('pt-BR')}
              </Text>
            ) : null}
            <Button
              label="Ver meus cupons"
              onPress={() => { setSuccessModal(null); setSection('coupons'); }}
              fullWidth
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  balanceCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.primary + '40',
    gap: Spacing.xs, ...Shadow.gold,
  },
  balanceTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.sm,
  },
  balanceGreeting: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  balancePoints: {
    fontSize: 52, fontWeight: FontWeight.bold, color: Colors.primary,
    lineHeight: 56, letterSpacing: -1,
  },
  balancePts: { fontSize: FontSize.md, color: Colors.textMuted, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
  ruleTag: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.primarySurface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  ruleText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  starsRow: { flexDirection: 'row', gap: 4, marginTop: Spacing.sm },
  infoCard: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.infoSurface, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  sectionTabs: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 4, gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md },
  sectionTabActive: { backgroundColor: Colors.primary },
  sectionTabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  sectionTabTextActive: { color: Colors.textOnPrimary },
  rewardCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  rewardCardLocked: { opacity: 0.75 },
  rewardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rewardIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rewardInfo: { flex: 1 },
  rewardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rewardType: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  ptsNeeded: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  ptsNeededCan: { backgroundColor: Colors.primary + '18' },
  ptsNeededCant: { backgroundColor: Colors.borderLight },
  ptsNeededText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ptsNeededTextCan: { color: Colors.primary },
  ptsNeededTextCant: { color: Colors.textMuted },
  rewardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  rewardValue: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  quantityWarn: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.medium },
  redeemBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 10, alignItems: 'center', ...Shadow.gold,
  },
  redeemBtnDisabled: { backgroundColor: Colors.borderLight, ...Shadow.sm },
  redeemBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  redeemBtnTextDisabled: { color: Colors.textMuted },
  textMuted: { color: Colors.textMuted },
  couponCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  couponUsed: { opacity: 0.65 },
  couponTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  couponLeft: { flex: 1, gap: 6 },
  couponRight: { alignItems: 'flex-end', gap: 4 },
  couponName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  couponCode: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary, letterSpacing: 2 },
  couponPts: { fontSize: FontSize.xs, color: Colors.textMuted },
  couponExpiry: { fontSize: FontSize.xs, color: Colors.textMuted },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  txIcon: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1, gap: 2 },
  txDesc: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium, lineHeight: 18 },
  txDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  txPoints: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  loginTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  loginSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  loginBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.full, marginTop: Spacing.sm, ...Shadow.gold,
  },
  loginBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalReward: { fontSize: FontSize.lg, color: Colors.textPrimary, textAlign: 'center' },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end' },
  couponBig: {
    backgroundColor: Colors.primarySurface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.primary + '40', borderStyle: 'dashed',
  },
  couponBigLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  couponBigCode: { fontSize: 32, fontWeight: FontWeight.bold, color: Colors.primary, letterSpacing: 4 },
});
