import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Alert, Platform, Modal } from 'react-native';
import { router } from 'expo-router';
import { MapPin, Star, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { addressesService } from '@/services/addresses';
import { Address } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

export default function AddressesScreen() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setIsLoading(false);
      return;
    }
    const data = await addressesService.getByUser(user.id);
    setAddresses(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = (id: string) => {
    if (Platform.OS === 'web') {
      setDeleteConfirm(id);
    } else {
      Alert.alert('Excluir endereço', 'Deseja excluir este endereço?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => doDelete(id) },
      ]);
    }
  };

  const doDelete = async (id: string) => {
    await addressesService.delete(id);
    setDeleteConfirm(null);
    load();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await addressesService.setDefault(id, user.id);
    load();
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando endereços..." />;

  return (
    <View style={styles.container}>
      {addresses.length === 0 ? (
        <EmptyState
          title="Nenhum endereço"
          subtitle="Adicione um endereço de entrega para continuar"
          icon="location-off"
          actionLabel="Adicionar endereço"
          onAction={() => router.push('/addresses/add')}
        />
      ) : (
        <>
          <FlatList
            data={addresses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.labelRow}>
                    <MapPin size={18} color={Colors.primary} />
                    <Text style={styles.label}>{item.label}</Text>
                    {item.is_default ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Padrão</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.actions}>
                    {!item.is_default ? (
                      <Pressable onPress={() => handleSetDefault(item.id)} hitSlop={8}>
                        <Star size={20} color={Colors.textMuted} />
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => handleDelete(item.id)} hitSlop={8}>
                      <Trash2 size={20} color={Colors.error} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.recipientName}>{item.recipient_name}</Text>
                <Text style={styles.addressText}>
                  {item.street}, {item.number}{item.complement ? ` - ${item.complement}` : ''}
                </Text>
                <Text style={styles.addressText}>
                  {item.neighborhood} — {item.city}/{item.state} — CEP {item.zip_code}
                </Text>
              </View>
            )}
          />
          <View style={styles.footer}>
            <Button
              label="Adicionar novo endereço"
              onPress={() => router.push('/addresses/add')}
              fullWidth
            />
          </View>
        </>
      )}

      {Platform.OS === 'web' && deleteConfirm ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Excluir endereço</Text>
              <Text style={styles.modalText}>Deseja excluir este endereço?</Text>
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancel} onPress={() => setDeleteConfirm(null)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.modalConfirm} onPress={() => doDelete(deleteConfirm)}>
                  <Text style={styles.modalConfirmText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: 6, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  defaultBadge: { backgroundColor: Colors.primarySurface, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  defaultText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  actions: { flexDirection: 'row', gap: Spacing.md },
  recipientName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  addressText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  footer: { padding: Spacing.lg, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: 300, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalText: { fontSize: FontSize.md, color: Colors.textSecondary },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.borderLight },
  modalCancelText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  modalConfirm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.error },
  modalConfirmText: { fontSize: FontSize.md, color: Colors.textOnPrimary, fontWeight: FontWeight.semibold },
});
