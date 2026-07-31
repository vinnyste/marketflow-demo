import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Alert, Platform } from 'react-native';
import { ArrowLeft, Store, MapPin, Copy, Check, MessageCircle, ExternalLink, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { settingsService } from '@/services/settings';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

const WHATSAPP_URL = 'https://wa.me/5500000000000';
const FALLBACK_ADDRESS = 'Avenida Exemplo, 100 - Centro, Cidade Demo - PR';

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [copiedVisible, setCopiedVisible] = useState(false);
  const [address, setAddress] = useState(FALLBACK_ADDRESS);

  useEffect(() => {
    Promise.all([
      settingsService.get('store_address'),
      settingsService.get('pickup_address'),
    ]).then(([storeAddress, pickupAddress]) => {
      const configured = storeAddress?.trim() || pickupAddress?.trim();
      if (configured) setAddress(configured);
    }).catch(() => {
      // O endereço fixo continua disponível mesmo se as configurações falharem.
    });
  }, []);

  const handleWhatsApp = async () => {
    try {
      await Linking.openURL(WHATSAPP_URL);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const handleOpenMap = async () => {
    const encoded = encodeURIComponent(address);
    const nativeUrl = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    }) as string;
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    try {
      await Linking.openURL(nativeUrl);
    } catch {
      try {
        await Linking.openURL(fallbackUrl);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
      }
    }
  };

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(address);
    setCopiedVisible(true);
    setTimeout(() => setCopiedVisible(false), 2000);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.primary} />
        </Pressable>
        <Text style={s.title}>Contato</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [s.card, pressed && { opacity: 0.88 }]}
          onPress={handleOpenMap}
          accessibilityRole="button"
          accessibilityLabel="Abrir endereço demonstrativo no mapa"
        >
          <View style={s.cardHeader}>
            <Store size={24} color={Colors.primary} />
            <Text style={s.cardTitle}>MarketFlow Demo</Text>
          </View>
          <View style={s.infoRow}>
            <MapPin size={20} color={Colors.primary} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={s.infoText}>{address}</Text>
              <Text style={s.mapHint}>Toque no endereço para abrir o mapa</Text>
            </View>
            <ExternalLink size={20} color={Colors.primary} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.mapBtn, pressed && { opacity: 0.85 }]}
          onPress={handleOpenMap}
        >
          <MapPin size={22} color="#111" />
          <Text style={s.mapBtnText}>Abrir rota no mapa</Text>
          <ExternalLink size={18} color="#111" style={{ marginLeft: 'auto' as any }} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
          onPress={handleCopyAddress}
        >
          <View style={s.actionIcon}>
            <Copy size={22} color={Colors.primary} />
          </View>
          <View style={s.actionInfo}>
            <Text style={s.actionTitle}>Copiar endereço</Text>
            <Text style={s.actionSub} numberOfLines={2}>{address}</Text>
          </View>
          {copiedVisible ? (
            <View style={s.copiedBadge}>
              <Check size={14} color={Colors.success} />
              <Text style={s.copiedText}>Copiado!</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.whatsappBtn, pressed && { opacity: 0.85 }]}
          onPress={handleWhatsApp}
        >
          <View style={s.whatsappIcon}>
            <MessageCircle size={24} color="#fff" />
          </View>
          <Text style={s.whatsappText}>Falar pelo WhatsApp</Text>
          <ExternalLink size={18} color="#fff" style={{ marginLeft: 'auto' as any }} />
        </Pressable>

        <View style={s.note}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={s.noteText}>
            Atendimento via WhatsApp sujeito ao horário de funcionamento da loja.
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
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  infoText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 23 },
  mapHint: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  mapBtn: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, ...Shadow.sm,
  },
  mapBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#111' },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  actionInfo: { flex: 1, gap: 2 },
  actionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  actionSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  copiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successSurface, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  copiedText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#25D366', borderRadius: Radius.lg,
    padding: Spacing.lg, ...Shadow.sm,
  },
  whatsappIcon: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  whatsappText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
});
