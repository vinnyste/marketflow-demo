import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { ImageUp, Trash2, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { mediaService, ADMIN_IMAGE_RULES, AdminImageKind } from '@/services/media';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type Props = {
  kind: AdminImageKind;
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

export function ImageUploadField({ kind, value, onChange, label = 'Imagem' }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadedInfo, setUploadedInfo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rule = ADMIN_IMAGE_RULES[kind];

  const handlePick = async () => {
    setUploading(true);
    setErrorMessage(null);
    setUploadedInfo(null);
    try {
      const result = await mediaService.pickAndUpload(kind);
      if (!result) return;
      onChange(result.publicUrl);
      setUploadedInfo(`${result.width} × ${result.height} px · ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
    } catch (error: any) {
      const message = error?.message || 'Não foi possível enviar a imagem.';
      setErrorMessage(message);
      const browserAlert = (globalThis as any).alert;
      if (Platform.OS === 'web' && typeof browserAlert === 'function') {
        browserAlert(`Imagem não aceita: ${message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.requirements}>
        Recomendado: {rule.recommended}. {rule.description}
      </Text>

      {value ? (
        <View style={[styles.previewBox, kind === 'banner' && styles.previewBoxBanner]}>
          <Image source={{ uri: value }} style={styles.preview} contentFit="cover" />
          <Pressable
            style={styles.removeButton}
            onPress={() => {
              onChange('');
              setUploadedInfo(null);
              setErrorMessage(null);
            }}
            hitSlop={8}
          >
            <Trash2 size={17} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.85 }, uploading && { opacity: 0.65 }]}
        onPress={handlePick}
        disabled={uploading}
      >
        <ImageUp size={20} color="#111" />
        <Text style={styles.pickButtonText}>{uploading ? 'Validando e enviando...' : 'Escolher imagem'}</Text>
      </Pressable>

      {uploadedInfo ? (
        <View style={styles.successRow}>
          <CheckCircle2 size={15} color={Colors.success} />
          <Text style={styles.successText}>Imagem enviada: {uploadedInfo}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorRow}>
          <AlertCircle size={15} color={Colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  requirements: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 17 },
  previewBox: {
    width: 180,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.borderLight,
    position: 'relative',
  },
  previewBoxBanner: { width: '100%', aspectRatio: 8 / 3 },
  preview: { width: '100%', height: '100%' },
  removeButton: {
    position: 'absolute', top: 8, right: 8,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(178,34,34,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickButton: {
    minHeight: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  pickButtonText: { color: '#111', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successText: { flex: 1, fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium },
  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: Colors.errorSurface, padding: 10, borderRadius: Radius.sm,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, lineHeight: 17 },
});
