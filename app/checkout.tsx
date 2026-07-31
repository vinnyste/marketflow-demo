import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Truck, Store, Clock, MapPin, Plus, CheckSquare, QrCode, CreditCard, Banknote, UtensilsCrossed, AlertTriangle, Info, Clock3, Receipt, ReceiptText, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { addressesService } from '@/services/addresses';
import { ordersService } from '@/services/orders';
import { settingsService } from '@/services/settings';
import { Address, DeliveryZone } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

type DeliveryType = 'delivery' | 'pickup';
type PaymentMethod = 'pix' | 'debit_card' | 'credit_card' | 'food_voucher' | 'cash';

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; icon: string }[] = [
  { method: 'pix', label: 'PIX na entrega', icon: 'qr-code' },
  { method: 'debit_card', label: 'Débito', icon: 'credit-card' },
  { method: 'credit_card', label: 'Crédito', icon: 'credit-card' },
  { method: 'food_voucher', label: 'Alimentação', icon: 'local-dining' },
  { method: 'cash', label: 'Dinheiro', icon: 'payments' },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [pickupAddress, setPickupAddress] = useState(
    'Avenida Exemplo, 100 - Centro, Cidade Demo - PR'
  );

  // CPF on invoice
  const [wantsCpf, setWantsCpf] = useState(false);
  const [cpf, setCpf] = useState('');

  // Delivery zone state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(null);
  const [deliveryUnavailable, setDeliveryUnavailable] = useState(false);

  // Business hours state
  const [hours, setHours] = useState<{
    deliveryOpen: string; deliveryClose: string;
    pickupOpen: string; pickupClose: string;
  } | null>(null);
  const [hoursAlert, setHoursAlert] = useState(false);
  const [hoursMessage, setHoursMessage] = useState('');

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;
  const effectiveDeliveryFee = deliveryType === 'pickup' ? 0 : (currentZone?.delivery_fee ?? 0);
  const total = totalPrice + effectiveDeliveryFee;
  const hasWeightItems = items.some((i) => i.product?.sold_by_weight);

  useEffect(() => {
    if (!placing && items.length === 0) {
      router.replace('/(tabs)/cart');
    }
  }, [items.length, placing]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      addressesService.getByUser(user.id),
      settingsService.getDeliveryZones(),
      settingsService.getBusinessHours(),
      settingsService.get('pickup_address'),
      settingsService.get('store_address'),
    ])
      .then(([addrData, zoneData, hoursData, configuredPickupAddress, storeAddress]) => {
        setAddresses(addrData);
        setDeliveryZones(zoneData);
        setHours(hoursData);
        const configuredAddress = configuredPickupAddress?.trim() || storeAddress?.trim();
        if (configuredAddress) setPickupAddress(configuredAddress);
        const def = addrData.find((a) => a.is_default);
        if (def) setSelectedAddress(def.id);
      })
      .catch((e: any) => {
        console.error('Erro ao carregar checkout:', e);
        Alert.alert('Erro', e?.message || 'Não foi possível carregar as opções de entrega.');
      })
      .finally(() => setLoadingAddresses(false));
  }, [user]);

  // Recalculate delivery zone when address or delivery type changes
  useEffect(() => {
    if (deliveryType !== 'delivery') {
      setCurrentZone(null);
      setDeliveryUnavailable(false);
      return;
    }
    if (!selectedAddress) {
      setCurrentZone(null);
      setDeliveryUnavailable(false);
      return;
    }
    const addr = addresses.find((a) => a.id === selectedAddress);
    if (!addr) return;
    const zone = settingsService.findZoneByNeighborhood(deliveryZones, addr.neighborhood);
    if (zone) {
      setCurrentZone(zone);
      setDeliveryUnavailable(false);
    } else {
      setCurrentZone(null);
      setDeliveryUnavailable(true);
    }
  }, [selectedAddress, deliveryType, addresses, deliveryZones]);

  const checkBusinessHours = useCallback((): boolean => {
    if (!hours) return true;
    if (deliveryType === 'delivery') {
      if (!settingsService.isWithinHours(hours.deliveryOpen, hours.deliveryClose)) {
        setHoursMessage(
          `Entregas disponíveis das ${hours.deliveryOpen} às ${hours.deliveryClose}. Tente novamente neste horário.`
        );
        setHoursAlert(true);
        return false;
      }
    } else {
      if (!settingsService.isWithinHours(hours.pickupOpen, hours.pickupClose)) {
        setHoursMessage(
          `Retiradas disponíveis das ${hours.pickupOpen} às ${hours.pickupClose}. Tente novamente neste horário.`
        );
        setHoursAlert(true);
        return false;
      }
    }
    return true;
  }, [hours, deliveryType]);

  const openPickupMap = async () => {
    const encoded = encodeURIComponent(pickupAddress);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    }) as string;
    const fallback = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    try {
      await Linking.openURL(url);
    } catch {
      try {
        await Linking.openURL(fallback);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    if (items.length === 0) {
      alert('Seu carrinho está vazio.');
      return;
    }

    if (!checkBusinessHours()) return;

    if (deliveryType === 'delivery') {
      if (!selectedAddress) {
        alert('Selecione um endereço de entrega.');
        return;
      }
      if (deliveryUnavailable) {
        alert('Entrega indisponível para este bairro.');
        return;
      }
    }

    // Validate CPF if requested
    if (wantsCpf && cpf.replace(/\D/g, '').length !== 11) {
      alert('CPF inválido. Verifique os números digitados.');
      return;
    }

    const changeForValue =
      paymentMethod === 'cash' && needsChange
        ? parseFloat(changeFor.replace(',', '.'))
        : undefined;
    if (
      paymentMethod === 'cash' &&
      needsChange &&
      (isNaN(changeForValue!) || changeForValue! <= total)
    ) {
      alert('Informe um valor para troco maior que o total do pedido.');
      return;
    }

    setPlacing(true);
    try {
      const order = await ordersService.createFromCart(
        user.id,
        deliveryType === 'delivery' ? selectedAddress! : null,
        items,
        paymentMethod,
        effectiveDeliveryFee,
        deliveryType,
        notes || undefined,
        changeForValue,
        wantsCpf,
        wantsCpf ? cpf.replace(/\D/g, '') : undefined
      );
      await clearCart();
      router.replace(`/orders/${order.id}`);
    } catch (e: any) {
      alert(e.message || 'Erro ao finalizar pedido.');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0 && !placing) return null;

  const isDeliveryOpen = hours ? settingsService.isWithinHours(hours.deliveryOpen, hours.deliveryClose) : true;
  const isPickupOpen = hours ? settingsService.isWithinHours(hours.pickupOpen, hours.pickupClose) : true;

  return (
    <>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Delivery type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Como deseja receber?</Text>
            <View style={styles.deliveryRow}>
              <Pressable
                style={[styles.deliveryBtn, deliveryType === 'delivery' && styles.deliveryBtnSelected]}
                onPress={() => setDeliveryType('delivery')}
              >
                <Truck size={26} color={deliveryType === 'delivery' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.deliveryBtnLabel, deliveryType === 'delivery' && styles.deliveryBtnLabelSelected]}>
                  Entrega
                </Text>
                {!isDeliveryOpen ? (
                  <Text style={styles.closedTag}>Fechado</Text>
                ) : currentZone && deliveryType === 'delivery' ? (
                  <Text style={styles.deliveryFeeTag}>{formatPrice(currentZone.delivery_fee)}</Text>
                ) : null}
              </Pressable>

              <Pressable
                style={[styles.deliveryBtn, deliveryType === 'pickup' && styles.deliveryBtnSelected]}
                onPress={() => setDeliveryType('pickup')}
              >
                <Store size={26} color={deliveryType === 'pickup' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.deliveryBtnLabel, deliveryType === 'pickup' && styles.deliveryBtnLabelSelected]}>
                  Retirada
                </Text>
                {!isPickupOpen ? (
                  <Text style={styles.closedTag}>Fechado</Text>
                ) : (
                  <Text style={styles.deliveryFreeTag}>Grátis</Text>
                )}
              </Pressable>
            </View>

            {/* Hours info */}
            {hours ? (
              <View style={styles.hoursRow}>
                <Clock size={13} color={Colors.textMuted} />
                <Text style={styles.hoursText}>
                  {deliveryType === 'delivery'
                    ? `Entregas: ${hours.deliveryOpen} – ${hours.deliveryClose}`
                    : `Retiradas: ${hours.pickupOpen} – ${hours.pickupClose}`}
                </Text>
                <View style={[styles.openBadge, (deliveryType === 'delivery' ? isDeliveryOpen : isPickupOpen) ? styles.openBadgeOpen : styles.openBadgeClosed]}>
                  <Text style={[styles.openBadgeText, (deliveryType === 'delivery' ? isDeliveryOpen : isPickupOpen) ? styles.openBadgeTextOpen : styles.openBadgeTextClosed]}>
                    {(deliveryType === 'delivery' ? isDeliveryOpen : isPickupOpen) ? 'Aberto' : 'Fechado'}
                  </Text>
                </View>
              </View>
            ) : null}

            {deliveryType === 'pickup' ? (
              <Pressable style={styles.pickupInfo} onPress={openPickupMap}>
                <Store size={18} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickupInfoTitle}>Retirada no MarketFlow Demo</Text>
                  <Text style={styles.pickupInfoText}>{pickupAddress}</Text>
                  <Text style={styles.pickupMapHint}>Toque para abrir no mapa</Text>
                </View>
                <ExternalLink size={18} color={Colors.primary} />
              </Pressable>
            ) : null}
          </View>

          {/* Address (only for delivery) */}
          {deliveryType === 'delivery' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Endereço de entrega</Text>
              {loadingAddresses ? (
                <LoadingSpinner size="small" />
              ) : addresses.length === 0 ? (
                <Pressable style={styles.addAddress} onPress={() => router.push('/addresses/add')}>
                  <MapPin size={20} color={Colors.primary} />
                  <Text style={styles.addAddressText}>Adicionar endereço</Text>
                </Pressable>
              ) : (
                <View style={styles.addressList}>
                  {addresses.map((addr) => {
                    const zone = settingsService.findZoneByNeighborhood(deliveryZones, addr.neighborhood);
                    const unavailable = !zone;
                    return (
                      <Pressable
                        key={addr.id}
                        style={[
                          styles.addressCard,
                          selectedAddress === addr.id && styles.addressSelected,
                          unavailable && styles.addressUnavailable,
                        ]}
                        onPress={() => setSelectedAddress(addr.id)}
                      >
                        <CheckSquare size={20} color={selectedAddress === addr.id ? Colors.primary : Colors.textMuted} />
                        <View style={styles.addressInfo}>
                          <View style={styles.addressLabelRow}>
                            <Text style={styles.addressLabel}>{addr.label}</Text>
                            {unavailable ? (
                              <Text style={styles.unavailableTag}>Entrega indisponível</Text>
                            ) : zone ? (
                              <Text style={styles.feeTag}>{formatPrice(zone.delivery_fee)}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.addressText}>
                            {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ''}
                          </Text>
                          <Text style={styles.addressText}>
                            {addr.neighborhood} — {addr.city}/{addr.state}
                          </Text>
                          {unavailable ? (
                            <Text style={styles.unavailableNote}>
                              Este bairro não está na área de entrega.
                            </Text>
                          ) : zone ? (
                            <Text style={styles.etaNote}>
                              Tempo estimado: ~{zone.estimated_minutes} min
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable style={styles.addAddress} onPress={() => router.push('/addresses/add')}>
                    <Plus size={18} color={Colors.primary} />
                    <Text style={styles.addAddressText}>Novo endereço</Text>
                  </Pressable>
                </View>
              )}

              {/* Delivery unavailable warning */}
              {deliveryUnavailable && selectedAddress ? (
                <View style={styles.warningBox}>
                  <AlertTriangle size={16} color={Colors.error} />
                  <Text style={styles.warningText}>
                    Entrega indisponível para este bairro. Escolha outro endereço ou selecione Retirada.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Payment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Forma de pagamento</Text>
            <Text style={styles.sectionSubtitle}>
              Pagamento na {deliveryType === 'pickup' ? 'retirada' : 'entrega'}
            </Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.method}
                  style={[styles.paymentBtn, paymentMethod === opt.method && styles.paymentSelected]}
                  onPress={() => {
                    setPaymentMethod(opt.method);
                    if (opt.method !== 'cash') setNeedsChange(false);
                  }}
                >
                  {opt.method === 'pix' ? <QrCode size={20} color={paymentMethod === opt.method ? Colors.primary : Colors.textSecondary} /> : opt.method === 'cash' ? <Banknote size={20} color={paymentMethod === opt.method ? Colors.primary : Colors.textSecondary} /> : opt.method === 'food_voucher' ? <UtensilsCrossed size={20} color={paymentMethod === opt.method ? Colors.primary : Colors.textSecondary} /> : <CreditCard size={20} color={paymentMethod === opt.method ? Colors.primary : Colors.textSecondary} />}
                  <Text style={[styles.paymentLabel, paymentMethod === opt.method && styles.paymentLabelSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Change for cash */}
            {paymentMethod === 'cash' ? (
              <View style={styles.changeSection}>
                <Text style={styles.changeQuestion}>Precisa de troco?</Text>
                <View style={styles.changeOptions}>
                  <Pressable
                    style={[styles.changeBtn, !needsChange && styles.changeBtnSelected]}
                    onPress={() => setNeedsChange(false)}
                  >
                    <CheckSquare size={18} color={!needsChange ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.changeBtnText, !needsChange && styles.changeBtnTextSelected]}>
                      Não preciso
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.changeBtn, needsChange && styles.changeBtnSelected]}
                    onPress={() => setNeedsChange(true)}
                  >
                    <CheckSquare size={18} color={needsChange ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.changeBtnText, needsChange && styles.changeBtnTextSelected]}>
                      Preciso de troco
                    </Text>
                  </Pressable>
                </View>
                {needsChange ? (
                  <View style={styles.changeInput}>
                    <Text style={styles.changeInputLabel}>Troco para quanto?</Text>
                    <View style={styles.changeInputRow}>
                      <Text style={styles.changeInputPrefix}>R$</Text>
                      <TextInput
                        style={styles.changeInputField}
                        value={changeFor}
                        onChangeText={setChangeFor}
                        placeholder="0,00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    {/* Provisional change notice */}
                    {hasWeightItems ? (
                      <View style={styles.provisionalNotice}>
                        <Info size={14} color={Colors.warning} />
                        <Text style={styles.provisionalText}>
                          Troco provisório — o valor final será recalculado após a pesagem dos itens por peso.
                        </Text>
                      </View>
                    ) : null}
                    {/* Change preview */}
                    {changeFor && !isNaN(parseFloat(changeFor.replace(',', '.'))) ? (
                      <View style={styles.changePreview}>
                        <Text style={styles.changePreviewLabel}>
                          {hasWeightItems ? 'Troco estimado:' : 'Troco:'}
                        </Text>
                        <Text style={styles.changePreviewValue}>
                          {(() => {
                            const val = parseFloat(changeFor.replace(',', '.'));
                            if (isNaN(val) || val <= total) return '—';
                            return formatPrice(val - total);
                          })()}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* CPF on invoice */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CPF na nota</Text>
            <View style={styles.deliveryRow}>
              <Pressable
                style={[styles.deliveryBtn, !wantsCpf && styles.deliveryBtnSelected]}
                onPress={() => setWantsCpf(false)}
              >
                <Receipt size={22} color={!wantsCpf ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.deliveryBtnLabel, !wantsCpf && styles.deliveryBtnLabelSelected]}>Não</Text>
              </Pressable>
              <Pressable
                style={[styles.deliveryBtn, wantsCpf && styles.deliveryBtnSelected]}
                onPress={() => setWantsCpf(true)}
              >
                <ReceiptText size={22} color={wantsCpf ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.deliveryBtnLabel, wantsCpf && styles.deliveryBtnLabelSelected]}>Sim</Text>
              </Pressable>
            </View>
            {wantsCpf ? (
              <View style={styles.notesBox}>
                <TextInput
                  style={[styles.notesInput, { minHeight: 0, height: 48 }]}
                  value={cpf}
                  onChangeText={(v) => {
                    const digits = v.replace(/\D/g, '').slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
                    else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
                    else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`;
                    setCpf(formatted);
                  }}
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Info size={13} color={Colors.textMuted} />
              <Text style={{ flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 }}>
                O CPF é registrado somente como solicitação. Não implica emissão de nota fiscal.
              </Text>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <View style={styles.notesBox}>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: Sem cebola, campainha não funciona..."
                multiline
                numberOfLines={3}
                placeholderTextColor={Colors.textMuted}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do pedido</Text>
            <View style={styles.summaryCard}>
              {items.map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <Text style={styles.summaryItem} numberOfLines={1}>
                    {item.product?.name}{' '}
                    {item.product?.sold_by_weight
                      ? `~${Number(item.quantity).toFixed(3)} ${item.product.unit}`
                      : `\u00D7${item.quantity}`}
                  </Text>
                  <Text style={styles.summaryPrice}>
                    {formatPrice((item.product?.price || 0) * Number(item.quantity))}
                    {item.product?.sold_by_weight ? ' *' : ''}
                  </Text>
                </View>
              ))}
              {hasWeightItems ? (
                <Text style={styles.weightNote}>* Valor estimado — sujeito a ajuste após pesagem</Text>
              ) : null}
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatPrice(totalPrice)}{hasWeightItems ? ' *' : ''}
                </Text>
              </View>
              {deliveryType === 'delivery' ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxa de entrega</Text>
                  <Text style={styles.summaryValue}>
                    {deliveryUnavailable || !currentZone
                      ? '—'
                      : formatPrice(effectiveDeliveryFee)}
                  </Text>
                </View>
              ) : (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxa de entrega</Text>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>Grátis</Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>
                  Total {hasWeightItems ? '(estimado)' : ''}
                </Text>
                <Text style={styles.totalValue}>{formatPrice(total)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.cta}>
          <View style={styles.ctaTop}>
            <Text style={styles.ctaTotalLabel}>
              Total {hasWeightItems ? '(estimado)' : ''}
            </Text>
            <Text style={styles.ctaTotalValue}>{formatPrice(total)}</Text>
          </View>
          <Button
            label="Confirmar pedido"
            onPress={handlePlaceOrder}
            loading={placing}
            fullWidth
            size="lg"
          />
        </View>
      </View>

      {/* Business hours closed modal */}
      <Modal visible={hoursAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Clock3 size={40} color={Colors.warning} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>
              {deliveryType === 'delivery' ? 'Entrega indisponível' : 'Retirada indisponível'}
            </Text>
            <Text style={styles.modalText}>{hoursMessage}</Text>
            <Pressable style={styles.modalBtn} onPress={() => setHoursAlert(false)}>
              <Text style={styles.modalBtnText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 20 },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: -8 },

  deliveryRow: { flexDirection: 'row', gap: Spacing.md },
  deliveryBtn: {
    flex: 1, alignItems: 'center', gap: 6, padding: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: 'transparent', ...Shadow.sm,
  },
  deliveryBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  deliveryBtnLabel: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  deliveryBtnLabelSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },
  deliveryFeeTag: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    backgroundColor: Colors.borderLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
  },
  deliveryFreeTag: {
    fontSize: FontSize.xs, color: Colors.success, backgroundColor: Colors.successSurface,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, fontWeight: FontWeight.semibold,
  },
  closedTag: {
    fontSize: FontSize.xs, color: Colors.error, backgroundColor: Colors.errorSurface,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, fontWeight: FontWeight.semibold,
  },

  hoursRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  hoursText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  openBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
  },
  openBadgeOpen: { backgroundColor: Colors.successSurface },
  openBadgeClosed: { backgroundColor: Colors.errorSurface },
  openBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  openBadgeTextOpen: { color: Colors.success },
  openBadgeTextClosed: { color: Colors.error },

  pickupInfo: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.primarySurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary, alignItems: 'flex-start',
  },
  pickupInfoTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.primary },
  pickupInfoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 2 },
  pickupMapHint: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 3 },

  addressList: { gap: Spacing.sm },
  addressCard: {
    flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 2, borderColor: 'transparent', ...Shadow.sm,
  },
  addressSelected: { borderColor: Colors.primary },
  addressUnavailable: { opacity: 0.7, borderColor: Colors.errorSurface },
  addressInfo: { flex: 1, gap: 2 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  addressText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  unavailableTag: {
    fontSize: FontSize.xs, color: Colors.error, backgroundColor: Colors.errorSurface,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full,
  },
  feeTag: {
    fontSize: FontSize.xs, color: Colors.success, backgroundColor: Colors.successSurface,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, fontWeight: FontWeight.semibold,
  },
  unavailableNote: { fontSize: FontSize.xs, color: Colors.error, marginTop: 2 },
  etaNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  addAddress: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primarySurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  addAddressText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.errorSurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.error,
  },
  warningText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, lineHeight: 20 },

  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  paymentBtn: {
    flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 4, padding: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: 'transparent', ...Shadow.sm,
  },
  paymentSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  paymentLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium, textAlign: 'center' },
  paymentLabelSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },

  changeSection: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm,
  },
  changeQuestion: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  changeOptions: { flexDirection: 'row', gap: Spacing.md },
  changeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  changeBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  changeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  changeBtnTextSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },
  changeInput: { gap: 8 },
  changeInputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  changeInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden',
  },
  changeInputPrefix: {
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSize.md, color: Colors.textSecondary,
    backgroundColor: Colors.borderLight, fontWeight: FontWeight.medium,
  },
  changeInputField: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },
  provisionalNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.warningSurface, borderRadius: Radius.sm, padding: Spacing.sm,
  },
  provisionalText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning, lineHeight: 16 },
  changePreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 4,
  },
  changePreviewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  changePreviewValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.success },

  notesBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  notesInput: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.textPrimary,
    minHeight: 80,
  },

  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: 8 },
  summaryPrice: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  totalLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border },
  weightNote: { fontSize: FontSize.xs, color: Colors.warning, fontStyle: 'italic' },

  cta: {
    backgroundColor: Colors.surface, padding: Spacing.lg, gap: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg,
  },
  ctaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctaTotalLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  ctaTotalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, width: 320, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: Spacing.md, alignItems: 'center', ...Shadow.gold,
  },
  modalBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
});
