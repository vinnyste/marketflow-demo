import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isoToBr(value: string | null | undefined): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

function brToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    year < 1900 ||
    date > new Date()
  ) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(formatPhone(profile?.phone || ''));
    setBirthDate(isoToBr(profile?.birth_date));
  }, [profile]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!user) {
      setError('Sua sessão expirou. Entre novamente.');
      return;
    }
    if (!fullName.trim()) {
      setError('Informe seu nome completo.');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Informe um celular válido com DDD.');
      return;
    }
    const birthDateIso = brToIso(birthDate);
    if (!birthDateIso) {
      setError('Informe uma data de nascimento válida no formato DD/MM/AAAA.');
      return;
    }

    setLoading(true);
    try {
      await authService.updateProfile(user.id, {
        full_name: fullName.trim(),
        phone: phoneDigits,
        birth_date: birthDateIso,
      });
      await refreshProfile();
      setSuccess('Perfil atualizado com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível atualizar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>Você pode alterar seu nome, celular e data de nascimento.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <AlertCircle size={17} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={17} color={Colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <Input
          label="Nome completo *"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          placeholder="Seu nome completo"
          leftIcon="person"
        />
        <Input
          label="Celular *"
          value={phone}
          onChangeText={(value) => setPhone(formatPhone(value))}
          keyboardType="phone-pad"
          placeholder="(00) 00000-0000"
          leftIcon="phone"
        />
        <Input
          label="Data de nascimento *"
          value={birthDate}
          onChangeText={(value) => setBirthDate(formatBirthDate(value))}
          keyboardType="numeric"
          placeholder="DD/MM/AAAA"
          leftIcon="cake"
        />
        <Input
          label="E-mail"
          value={profile?.email || user?.email || ''}
          onChangeText={() => {}}
          editable={false}
          leftIcon="email"
        />
        <Text style={styles.emailHint}>Para trocar o e-mail, será necessário confirmar o novo endereço.</Text>

        <Button label="Salvar alterações" onPress={handleSave} loading={loading} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.errorSurface,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: FontSize.sm },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.successSurface,
  },
  successText: { flex: 1, color: Colors.success, fontSize: FontSize.sm },
  emailHint: { marginTop: -8, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 17 },
});
