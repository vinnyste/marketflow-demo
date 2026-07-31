import React, { useState } from 'react';
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
import { ArrowLeft, AlertCircle } from 'lucide-react-native';
import { authService } from '@/services/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value;
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDate(formatted: string): string | null {
  const parts = formatted.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const now = new Date();
  if (y < 1900 || y > now.getFullYear()) return null;
  return `${year}-${month}-${day}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Nome completo é obrigatório.';
    if (!email.trim()) {
      errs.email = 'E-mail é obrigatório.';
    } else if (!isValidEmail(email)) {
      errs.email = 'Informe um e-mail válido.';
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) {
      errs.phone = 'Celular é obrigatório.';
    } else if (phoneDigits.length < 10) {
      errs.phone = 'Informe um celular válido com DDD.';
    }
    if (!birthDate.trim()) {
      errs.birthDate = 'Data de nascimento é obrigatória.';
    } else if (!parseBirthDate(birthDate)) {
      errs.birthDate = 'Informe uma data válida no formato DD/MM/AAAA.';
    }
    if (!password) {
      errs.password = 'Senha é obrigatória.';
    } else if (password.length < 6) {
      errs.password = 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Confirme sua senha.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'As senhas não coincidem.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    const isoDate = parseBirthDate(birthDate)!;
    setLoading(true);
    try {
      await authService.signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.replace(/\D/g, ''),
        birthDate: isoDate,
      });
      router.replace({
        pathname: '/auth/verify-email',
        params: { email: email.trim() },
      });
    } catch (e: any) {
      setErrors({ general: e.message || 'Erro ao criar conta. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Criar conta</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.form}>
          {errors.general ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          ) : null}

          <Input
            label="Nome completo *"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Seu nome completo"
            leftIcon="person"
            autoCapitalize="words"
            error={errors.fullName}
          />
          <Input
            label="Celular *"
            value={phone}
            onChangeText={(v) => setPhone(formatPhone(v))}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            leftIcon="phone"
            error={errors.phone}
          />
          <Input
            label="Data de nascimento *"
            value={birthDate}
            onChangeText={(v) => setBirthDate(formatBirthDate(v))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            leftIcon="cake"
            error={errors.birthDate}
          />
          <Input
            label="E-mail *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="seu@email.com"
            leftIcon="email"
            error={errors.email}
          />
          <Input
            label="Senha *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 6 caracteres"
            leftIcon="lock"
            error={errors.password}
          />
          <Input
            label="Confirmar senha *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Repita sua senha"
            leftIcon="lock-outline"
            error={errors.confirmPassword}
          />

          <Button
            label="Criar conta"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <Pressable onPress={() => router.push('/auth/login')} hitSlop={8}>
            <Text style={styles.footerLink}>Fazer login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  form: { gap: Spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
});
