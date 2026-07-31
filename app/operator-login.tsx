import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

export default function OperatorLoginScreen() {
  const insets = useSafeAreaInsets();
  const { authInitialized, isOperator, isAdmin, refreshAuth, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      if (!data.user) throw new Error('Usuário não encontrado.');

      const p = await authService.getProfile(data.user.id);
      if (!p) {
        await signOut();
        throw new Error('Perfil não encontrado.');
      }
      if (!p.active) {
        await signOut();
        throw new Error('Conta desativada. Contate o administrador.');
      }
      if (p.role !== 'operator' && p.role !== 'admin') {
        await signOut();
        throw new Error('Acesso negado. Esta área é exclusiva para operadores.');
      }

      await refreshAuth();
    } catch (e: any) {
      console.error('Erro de rede no login operador:', {
        message: e?.message,
        name: e?.name,
        details: e,
      });
      setError(e.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS === 'web') {
    return <Redirect href="/admin-login" />;
  }

  if (!authInitialized) {
    return <LoadingSpinner fullScreen message="Verificando sessão..." />;
  }
  if (isOperator || isAdmin) return <Redirect href="/operator" />;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/marketflow-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.subtitle}>Área Operacional</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Login do operador</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputRow}>
              <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPass}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8} style={styles.eyeBtn}>
                {showPass
                  ? <EyeOff size={18} color={Colors.textMuted} />
                  : <Eye     size={18} color={Colors.textMuted} />
                }
              </Pressable>
            </View>
          </View>

          <Button label="Entrar" onPress={handleLogin} loading={loading} fullWidth size="lg" />

          <Pressable style={styles.backLink} onPress={() => router.replace('/')}>
            <ArrowLeft size={14} color={Colors.textMuted} />
            <Text style={styles.backText}>Voltar ao aplicativo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.xl },
  header: { alignItems: 'center', gap: Spacing.sm },
  logo: { width: 200, height: 72 },
  subtitle: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.medium },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, gap: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  errorBox: {
    backgroundColor: Colors.errorSurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.error + '44',
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, height: 52, overflow: 'hidden',
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1, paddingHorizontal: 12, fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeBtn: { paddingRight: 14 },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backText: { fontSize: FontSize.sm, color: Colors.textMuted },
});
