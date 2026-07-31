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
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { AlertCircle, Settings, ChevronRight } from 'lucide-react-native';
import { authService } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.signIn({ email: email.trim().toLowerCase(), password });
      await refreshAuth();
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Email ou senha incorretos.');
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
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoRing}>
            <Image
              source={require('@/assets/images/marketflow-logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={300}
            />
          </View>
          <View style={styles.goldDivider} />
          <Text style={styles.subtitle}>Faça login na sua conta</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="seu@email.com"
            leftIcon="email"
          />
          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Sua senha"
            leftIcon="lock"
          />

          <Button
            label="Entrar"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Ainda não tem conta? </Text>
          <Pressable onPress={() => router.push('/auth/register')} hitSlop={8}>
            <Text style={styles.footerLink}>Cadastre-se</Text>
          </Pressable>
        </View>

        <View style={styles.adminLinkWrapper}>
          <Pressable
            onPress={() => router.push('/admin-login')}
            style={({ pressed }) => [styles.adminLink, pressed && { opacity: 0.7 }]}
          >
            <Settings size={18} color={Colors.textMuted} />
            <Text style={styles.adminLinkText}>Painel administrativo</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },

  logoSection: { alignItems: 'center', gap: Spacing.md },
  logoRing: {
    width: 160,
    height: 160,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    ...Shadow.gold,
  },
  logo: { width: 140, height: 140, borderRadius: Radius.full },
  goldDivider: {
    width: 60,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    opacity: 0.7,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary },

  form: { gap: Spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },

  adminLinkWrapper: { alignItems: 'center' },
  adminLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  adminLinkText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
});
