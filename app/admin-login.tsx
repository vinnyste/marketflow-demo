import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { authService } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function AdminLoginScreen() {
  const { authInitialized, isAdmin, isOperator, refreshAuth, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleLogin = async () => {
    if (!email || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true);
    setError('');
    try {
      const { user } = await authService.signIn({ email: email.trim().toLowerCase(), password });
      if (!user) throw new Error('Falha na autenticação.');

      const p = await authService.getProfile(user.id);

      if (!p) {
        await signOut();
        throw new Error('Perfil não encontrado. Entre em contato com o suporte.');
      }
      if (p.active === false) {
        await signOut();
        throw new Error('Esta conta está desativada. Entre em contato com o suporte.');
      }
      if (p.role !== 'admin' && p.role !== 'operator') {
        await signOut();
        throw new Error('Acesso negado. Esta área é exclusiva para administradores e operadores.');
      }

      // Synchronize the context before entering the protected layout.
      await refreshAuth();
    } catch (e: any) {
      console.error('Erro de rede no login:', {
        message: e?.message,
        name: e?.name,
        details: e,
      });
      const message = typeof e?.message === 'string' ? e.message : '';

      if (/failed to fetch|network request failed|fetch failed|load failed/i.test(message)) {
        setError('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
      } else if (/invalid login credentials/i.test(message)) {
        setError('Email ou senha inválidos.');
      } else if (/email not confirmed/i.test(message)) {
        setError('Confirme seu email antes de entrar.');
      } else if (/too many requests/i.test(message)) {
        setError('Muitas tentativas de acesso. Aguarde um pouco e tente novamente.');
      } else {
        setError(message || 'Email ou senha inválidos.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading only during cold-start session restore
  if (!authInitialized) {
    return <LoadingSpinner fullScreen message="Verificando sessão..." />;
  }
  if (isAdmin) return <Redirect href="/admin" />;
  if (isOperator) return <Redirect href="/operator" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image
            source={require('@/assets/images/marketflow-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.subtitle}>Painel Administrativo e Operacional</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldAlert size={22} color={Colors.primary} />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Acesso restrito</Text>
              <Text style={styles.cardSub}>Acesso exclusivo para administradores e operadores.</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="admin@example.com"
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
          <Button label="Entrar" onPress={handleLogin} loading={loading} fullWidth size="lg" />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.xl, gap: Spacing.xl, minHeight: '100%' as any, justifyContent: 'center' },
  logoArea: { alignItems: 'center', gap: Spacing.sm },
  logo: { width: 200, height: 72 },
  subtitle: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.adminBorder,
  },
  cardHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  cardHeaderText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  cardSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 20, flexShrink: 1 },
  errorBox: {
    backgroundColor: Colors.errorSurface, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
});
