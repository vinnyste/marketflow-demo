import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert,
} from 'react-native';
import { Info, BellOff, CheckCircle, Clock, FileText, Trash2, Send, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { NotificationMessage } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  draft:     { label: 'Rascunho',  color: Colors.adminTextMuted, bg: Colors.adminBackground, Icon: FileText },
  scheduled: { label: 'Agendada', color: Colors.warning,        bg: Colors.warningSurface,   Icon: Clock },
  sent:      { label: 'Enviada',  color: Colors.success,        bg: Colors.successSurface,   Icon: CheckCircle },
};

async function loadMessages(): Promise<NotificationMessage[]> {
  const { data, error } = await supabase
    .from('notification_messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as NotificationMessage[];
}

async function saveMessage(payload: Omit<NotificationMessage, 'id' | 'sent_at' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('notification_messages').insert(payload);
  if (error) throw error;
}

async function markSent(id: string): Promise<void> {
  const { error } = await supabase
    .from('notification_messages')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('notification_messages').delete().eq('id', id);
  if (error) throw error;
}

const EMPTY_FORM = () => ({
  title: '',
  message: '',
  target: 'all' as 'all' | 'selected',
  scheduled_at: null as string | null,
  status: 'draft' as 'draft' | 'scheduled',
});

export default function AdminNotificationsScreen() {
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMessages(await loadMessages()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Título obrigatório'); return; }
    if (!form.message.trim()) { Alert.alert('Mensagem obrigatória'); return; }
    setSaving(true);
    try {
      await saveMessage({
        title: form.title.trim(),
        message: form.message.trim(),
        target: form.target,
        target_user_ids: null,
        scheduled_at: form.scheduled_at,
        status: form.status,
      });
      setShowForm(false);
      setForm(EMPTY_FORM());
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = (msg: NotificationMessage) => {
    Alert.alert(
      'Confirmar envio',
      `Marcar "${msg.title}" como enviada?\n\nAtenção: o envio real de notificações push requer configuração adicional de um serviço externo (ex: Expo Notifications). Esta ação apenas registra o envio no histórico.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: async () => {
            await markSent(msg.id);
            await load();
          },
        },
      ]
    );
  };

  const handleDelete = (msg: NotificationMessage) => {
    Alert.alert('Excluir', `Excluir "${msg.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => { await deleteMessage(msg.id); await load(); },
      },
    ]);
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando notificações..." />;

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Notificações</Text>

        <View style={s.infoCard}>
          <Info size={16} color={Colors.info} />
          <Text style={s.infoText}>
            O envio real de notificações push requer configuração de serviço externo. Aqui você cria e agenda mensagens — o histórico de envios fica registrado.
          </Text>
        </View>

        <Button label="Nova notificação" onPress={() => { setForm(EMPTY_FORM()); setShowForm(true); }} fullWidth />

        {messages.length === 0 ? (
          <View style={s.empty}>
            <BellOff size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhuma notificação criada ainda.</Text>
          </View>
        ) : null}

        {messages.map((msg) => {
          const st = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG['draft'];
          return (
            <View key={msg.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.statusDot, { backgroundColor: st.bg }]}>
                  <st.Icon size={16} color={st.color} />
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>{msg.title}</Text>
                  <Text style={s.cardMsg} numberOfLines={2}>{msg.message}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              <View style={s.cardMeta}>
                <Text style={s.meta}>
                  {msg.target === 'all' ? 'Todos os clientes' : 'Clientes selecionados'}
                </Text>
                {msg.scheduled_at ? (
                  <Text style={s.meta}>
                    Agendada: {new Date(msg.scheduled_at).toLocaleString('pt-BR')}
                  </Text>
                ) : null}
                {msg.sent_at ? (
                  <Text style={s.meta}>
                    Enviada: {new Date(msg.sent_at).toLocaleString('pt-BR')}
                  </Text>
                ) : null}
                <Text style={s.meta}>
                  Criada: {new Date(msg.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>

              <View style={s.cardActions}>
                {msg.status !== 'sent' ? (
                  <Pressable style={s.sendBtn} onPress={() => handleSendNow(msg)}>
                    <Send size={14} color="#fff" />
                    <Text style={s.sendBtnText}>Marcar como enviada</Text>
                  </Pressable>
                ) : null}
                <Pressable style={s.deleteBtn} onPress={() => handleDelete(msg)}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalSheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
            <Text style={s.modalTitle}>Nova notificação</Text>

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Título *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="Título da notificação"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Mensagem *</Text>
              <TextInput
                style={[s.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form.message}
                onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
                placeholder="Corpo da mensagem..."
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Público</Text>
              <View style={s.targetRow}>
                <Pressable
                  style={[s.targetBtn, form.target === 'all' && s.targetBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, target: 'all' }))}
                >
                  <Users size={18} color={form.target === 'all' ? Colors.primary : Colors.textMuted} />
                  <Text style={[s.targetBtnText, form.target === 'all' && s.targetBtnTextActive]}>Todos</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Status</Text>
              <View style={s.targetRow}>
                <Pressable
                  style={[s.targetBtn, form.status === 'draft' && s.targetBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, status: 'draft' }))}
                >
                  <Text style={[s.targetBtnText, form.status === 'draft' && s.targetBtnTextActive]}>Rascunho</Text>
                </Pressable>
                <Pressable
                  style={[s.targetBtn, form.status === 'scheduled' && s.targetBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, status: 'scheduled' }))}
                >
                  <Text style={[s.targetBtnText, form.status === 'scheduled' && s.targetBtnTextActive]}>Agendado</Text>
                </Pressable>
              </View>
            </View>

            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
              <Button label="Salvar" onPress={handleSave} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  infoCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.infoSurface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  statusDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  cardMsg: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 18 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, flexShrink: 0 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  sendBtnText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.semibold },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  targetRow: { flexDirection: 'row', gap: Spacing.sm },
  targetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: Spacing.sm, backgroundColor: Colors.background,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
  },
  targetBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  targetBtnText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  targetBtnTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
});
