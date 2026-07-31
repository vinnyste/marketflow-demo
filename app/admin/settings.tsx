import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Pressable, Switch,
} from 'react-native';
import { Truck, Star, Megaphone, Info, X, Check } from 'lucide-react-native';
import { settingsService } from '@/services/settings';
import { StoreSetting } from '@/types/database';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const BOOL_KEYS = ['orders_paused', 'app_paused'];

const GROUPS = [
  {
    title: 'Identidade do estabelecimento',
    keys: ['store_name', 'store_phone', 'store_whatsapp', 'store_address', 'store_email', 'store_logo_url'],
  },
  {
    title: 'Controle do aplicativo',
    keys: ['orders_paused', 'closed_message', 'app_paused', 'maintenance_message'],
  },
];

// Dismissible info banner keys (stored in component state only — no DB write)
const INFO_BANNERS = [
  { id: 'tip_delivery',   BannerIcon: Truck,     color: Colors.info,    text: 'Taxas, horários e zonas de entrega → aba Delivery' },
  { id: 'tip_loyalty',    BannerIcon: Star,      color: '#9B72CF',     text: 'Pontos, recompensas e cupons → Clube MarketFlow' },
  { id: 'tip_marketing',  BannerIcon: Megaphone, color: Colors.warning, text: 'Banners, promoções e notificações → aba Marketing' },
];

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState<StoreSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [showRestore, setShowRestore] = useState(false);

  const load = async () => {
    const data = await settingsService.getAll();
    setSettings(data);
    const v: Record<string, string> = {};
    data.forEach((s) => { v[s.key] = s.value; });
    setValues(v);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await settingsService.update(key, values[key] ?? '');
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(null);
    }
  };

  const handleImageSettingChange = async (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaving(key);
    try {
      await settingsService.update(key, value);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar a imagem.');
    } finally {
      setSaving(null);
    }
  };

  const toggleBool = async (key: string) => {
    const newVal = values[key] === 'true' ? 'false' : 'true';
    setValues((v) => ({ ...v, [key]: newVal }));
    try { await settingsService.update(key, newVal); }
    catch (e: any) { alert(e.message); }
  };

  const dismiss = (id: string) => {
    setDismissedBanners((prev) => {
      const next = [...prev, id];
      setShowRestore(next.length === INFO_BANNERS.length);
      return next;
    });
  };

  const restoreAll = () => {
    setDismissedBanners([]);
    setShowRestore(false);
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando configurações..." />;

  const settingMap: Record<string, StoreSetting> = {};
  settings.forEach((s) => { settingMap[s.key] = s; });

  const visibleBanners = INFO_BANNERS.filter((b) => !dismissedBanners.includes(b.id));

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Configurações Gerais</Text>

      {/* Dismissible info banners */}
      {visibleBanners.length > 0 ? (
        <View style={s.bannersBox}>
          {visibleBanners.map((b) => (
            <View key={b.id} style={[s.infoBanner, { borderColor: b.color + '44' }]}>
              <b.BannerIcon size={16} color={b.color} />
              <Text style={s.infoBannerText}>{b.text}</Text>
              <Pressable onPress={() => dismiss(b.id)} hitSlop={8} style={s.dismissBtn}>
                <X size={14} color={Colors.adminTextMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : showRestore ? (
        <Pressable style={s.restoreBtn} onPress={restoreAll}>
          <Info size={14} color={Colors.adminTextMuted} />
          <Text style={s.restoreBtnText}>Restaurar avisos informativos</Text>
        </Pressable>
      ) : null}

      {GROUPS.map((group) => {
        const groupSettings = group.keys.map((k) => settingMap[k]).filter(Boolean);
        if (groupSettings.length === 0) return null;
        return (
          <View key={group.title} style={s.group}>
            <Text style={s.groupTitle}>{group.title}</Text>
            <View style={s.groupCard}>
              {groupSettings.map((setting, idx) => {
                const isBool = BOOL_KEYS.includes(setting.key);
                const isLast = idx === groupSettings.length - 1;
                return (
                  <View key={setting.key}>
                    <View style={s.settingRow}>
                      {isBool ? (
                        <View style={s.boolRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.settingLabel}>{setting.label}</Text>
                            {setting.description ? (
                              <Text style={s.settingDesc}>{setting.description}</Text>
                            ) : null}
                          </View>
                          <Switch
                            value={values[setting.key] === 'true'}
                            onValueChange={() => toggleBool(setting.key)}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                            thumbColor="#fff"
                          />
                        </View>
                      ) : (
                        <View style={s.inputWrapper}>
                          <View style={s.labelRow}>
                            <Text style={s.settingLabel}>{setting.label}</Text>
                            {saved === setting.key ? (
                              <View style={s.savedBadge}>
                                <Check size={12} color={Colors.success} />
                                <Text style={s.savedText}>Salvo</Text>
                              </View>
                            ) : null}
                          </View>
                          {setting.description ? (
                            <Text style={s.settingDesc}>{setting.description}</Text>
                          ) : null}
                          {setting.key === 'store_logo_url' ? (
                            <ImageUploadField
                              kind="logo"
                              value={values[setting.key] ?? ''}
                              onChange={(value) => void handleImageSettingChange(setting.key, value)}
                              label="Logo do estabelecimento"
                            />
                          ) : (
                            <View style={s.inputRow}>
                              <TextInput
                                style={s.settingInput}
                                value={values[setting.key] ?? ''}
                                onChangeText={(v) => setValues({ ...values, [setting.key]: v })}
                                placeholder={setting.value || setting.label}
                                placeholderTextColor={Colors.adminTextMuted}
                                autoCapitalize="none"
                              />
                              <Pressable
                                style={[s.saveBtn, saving === setting.key && s.saveBtnLoading]}
                                onPress={() => handleSave(setting.key)}
                                disabled={saving === setting.key}
                              >
                                {saving === setting.key
                                  ? <Check size={16} color="rgba(255,255,255,0.5)" />
                                  : <Check size={16} color="#fff" />
                                }
                              </Pressable>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    {!isLast ? <View style={s.divider} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  bannersBox: { gap: Spacing.sm },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1,
  },
  infoBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.adminTextMuted },
  dismissBtn: { padding: 4 },
  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.sm,
  },
  restoreBtnText: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  group: { gap: Spacing.sm },
  groupTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.adminTextMuted,
    textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.adminBorder, overflow: 'hidden',
  },
  settingRow: { padding: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.adminBorder, marginHorizontal: Spacing.md },
  boolRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inputWrapper: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.adminText },
  settingDesc: { fontSize: FontSize.xs, color: Colors.adminTextMuted, lineHeight: 16 },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successSurface, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  savedText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  settingInput: {
    flex: 1, height: 44, borderWidth: 1, borderColor: Colors.adminBorder,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, color: Colors.adminText, backgroundColor: Colors.adminBackground,
  },
  saveBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnLoading: { backgroundColor: Colors.primaryLight },
});
