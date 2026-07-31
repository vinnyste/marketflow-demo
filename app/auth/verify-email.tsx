import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle, Mail, AlertCircle, Edit, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCooldown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCanResend(false);
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === OTP_LENGTH) {
      handleVerify(digits);
    }
  };

  const handleVerify = async (token?: string) => {
    const finalCode = token || code;
    if (finalCode.length !== OTP_LENGTH) {
      setError('Informe o código de 6 dígitos enviado ao seu e-mail.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: finalCode,
        type: 'email',
      });
      if (verifyError) {
        if (
          verifyError.message?.toLowerCase().includes('expired') ||
          verifyError.message?.toLowerCase().includes('invalid')
        ) {
          setError('Código incorreto ou expirado. Solicite um novo código.');
        } else if (verifyError.message?.toLowerCase().includes('rate')) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError(verifyError.message || 'Erro ao verificar o código.');
        }
        setCode('');
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.replace('/');
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) {
        setError(resendError.message || 'Erro ao reenviar o código.');
        return;
      }
      setCode('');
      startCooldown();
    } finally {
      setResendLoading(false);
    }
  };

  const handleChangeEmail = () => {
    router.replace('/auth/register');
  };

  // Render digit boxes
  const renderBoxes = () => {
    return Array.from({ length: OTP_LENGTH }).map((_, i) => {
      const char = code[i] || '';
      const isActive = code.length === i && !success;
      return (
        <Pressable
          key={i}
          style={[
            styles.digitBox,
            isActive && styles.digitBoxActive,
            char && styles.digitBoxFilled,
            success && styles.digitBoxSuccess,
          ]}
          onPress={() => inputRef.current?.focus()}
        >
          <Text style={[styles.digitText, success && styles.digitTextSuccess]}>
            {char || (isActive ? '|' : '')}
          </Text>
        </Pressable>
      );
    });
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
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>

        {/* Icon */}
        <View style={styles.iconWrapper}>
          {success ? (
            <CheckCircle size={64} color={Colors.success} />
          ) : (
            <Mail size={64} color={Colors.primary} />
          )}
        </View>

        <Text style={styles.title}>
          {success ? 'E-mail confirmado!' : 'Confirme seu e-mail'}
        </Text>

        {!success ? (
          <>
            <Text style={styles.subtitle}>
              Enviamos um código de 6 dígitos para{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* Hidden real input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="numeric"
              maxLength={OTP_LENGTH}
              autoFocus
              caretHidden
            />

            {/* Visual digit boxes */}
            <Pressable style={styles.boxesRow} onPress={() => inputRef.current?.focus()}>
              {renderBoxes()}
            </Pressable>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Confirm button */}
            <Pressable
              style={[styles.confirmBtn, (loading || code.length !== OTP_LENGTH) && styles.confirmBtnDisabled]}
              onPress={() => handleVerify()}
              disabled={loading || code.length !== OTP_LENGTH}
            >
              {loading ? (
                <Text style={styles.confirmBtnText}>Verificando...</Text>
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar conta</Text>
              )}
            </Pressable>

            {/* Resend */}
            <View style={styles.resendRow}>
              {canResend ? (
                <Pressable onPress={handleResend} disabled={resendLoading} hitSlop={8}>
                  <Text style={styles.resendLink}>
                    {resendLoading ? 'Reenviando...' : 'Reenviar código'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.resendCooldown}>
                  Reenviar em <Text style={styles.cooldownNum}>{cooldown}s</Text>
                </Text>
              )}
            </View>

            {/* Change email */}
            <Pressable style={styles.changeEmailBtn} onPress={handleChangeEmail} hitSlop={8}>
              <Edit size={14} color={Colors.textMuted} />
              <Text style={styles.changeEmailText}>Alterar e-mail</Text>
            </Pressable>

            <View style={styles.infoCard}>
              <Info size={14} color={Colors.info} />
              <Text style={styles.infoText}>
                Não recebeu? Verifique a caixa de spam. O código expira em 60 minutos.
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.successText}>
            Sua conta foi ativada com sucesso. Redirecionando...
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  backBtn: { alignSelf: 'flex-start' },
  iconWrapper: { marginTop: Spacing.lg },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  digitBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  digitBoxFilled: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surface,
  },
  digitBoxSuccess: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(107,163,104,0.15)',
  },
  digitText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  digitTextSuccess: { color: Colors.success },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    width: '100%',
    alignItems: 'center',
    ...Shadow.gold,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  resendRow: {
    alignItems: 'center',
  },
  resendLink: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    textDecorationLine: 'underline',
  },
  resendCooldown: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  cooldownNum: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  changeEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeEmailText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  infoCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  successText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
