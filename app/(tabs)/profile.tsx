import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MapPin, Receipt, Info, Shield, Scale, HelpCircle, MessageCircle, LogOut, ChevronRight, UserRoundPen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

interface MenuItemProps {
  IconComponent: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ IconComponent, label, onPress, danger }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.borderLight }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <IconComponent size={20} color={danger ? Colors.error : Colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <ChevronRight size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      setConfirmVisible(true);
    } else {
      Alert.alert('Sair da conta', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => signOut().then(() => router.replace('/auth/login')) },
      ]);
    }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'C';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile?.full_name || 'Cliente'}</Text>
          <Text style={styles.email}>{profile?.email || ''}</Text>
          {profile?.phone ? (
            <Text style={styles.phone}>{profile.phone}</Text>
          ) : null}
        </View>
      </View>

      {/* Gold divider */}
      <View style={styles.goldLine} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minha conta</Text>
          <View style={styles.card}>
            <MenuItem IconComponent={UserRoundPen} label="Editar perfil" onPress={() => router.push('/profile/edit')} />
            <View style={styles.divider} />
            <MenuItem IconComponent={MapPin} label="Meus endereços" onPress={() => router.push('/addresses')} />
            <View style={styles.divider} />
            <MenuItem IconComponent={Receipt} label="Histórico de pedidos" onPress={() => router.push('/(tabs)/orders')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          <View style={styles.card}>
            <MenuItem IconComponent={Info} label="Sobre o app" onPress={() => router.push('/about')} />
            <View style={styles.divider} />
            <MenuItem IconComponent={Shield} label="Política de Privacidade" onPress={() => router.push('/privacy')} />
            <View style={styles.divider} />
            <MenuItem IconComponent={Scale} label="Termos de Uso" onPress={() => router.push('/terms')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suporte</Text>
          <View style={styles.card}>
            <MenuItem IconComponent={HelpCircle} label="Ajuda" onPress={() => router.push('/help')} />
            <View style={styles.divider} />
            <MenuItem IconComponent={MessageCircle} label="Contato" onPress={() => router.push('/contact')} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <MenuItem IconComponent={LogOut} label="Sair da conta" onPress={handleSignOut} danger />
          </View>
        </View>
      </ScrollView>

      {Platform.OS === 'web' ? (
        <Modal visible={confirmVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Sair da conta</Text>
              <Text style={styles.modalText}>Deseja sair da sua conta?</Text>
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancel} onPress={() => setConfirmVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.modalConfirm}
                  onPress={() => {
                    setConfirmVisible(false);
                    signOut().then(() => router.replace('/auth/login'));
                  }}
                >
                  <Text style={styles.modalConfirmText}>Sair</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  avatarRing: {
    padding: 2,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Shadow.gold,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  headerInfo: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  email: { fontSize: FontSize.sm, color: Colors.textMuted },
  phone: { fontSize: FontSize.sm, color: Colors.textSecondary },
  goldLine: { height: 1.5, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 56 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    minHeight: 56,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: Colors.errorSurface },
  menuLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  menuLabelDanger: { color: Colors.error },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: 300,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalText: { fontSize: FontSize.md, color: Colors.textSecondary },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  modalCancel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  modalConfirm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.error },
  modalConfirmText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
});
