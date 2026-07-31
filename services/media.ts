import { Image as RNImage, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

export type AdminImageKind = 'product' | 'category' | 'banner' | 'logo';

type ImageRule = {
  folder: string;
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  minRatio: number;
  maxRatio: number;
  recommended: string;
  description: string;
};

export const ADMIN_IMAGE_RULES: Record<AdminImageKind, ImageRule> = {
  product: {
    folder: 'products',
    maxBytes: 2 * 1024 * 1024,
    minWidth: 500,
    minHeight: 500,
    minRatio: 0.75,
    maxRatio: 1.33,
    recommended: '1200 × 1200 px',
    description: 'JPG, PNG ou WebP, quase quadrada, até 2 MB.',
  },
  category: {
    folder: 'categories',
    maxBytes: 2 * 1024 * 1024,
    minWidth: 500,
    minHeight: 500,
    minRatio: 0.75,
    maxRatio: 1.33,
    recommended: '1200 × 1200 px',
    description: 'JPG, PNG ou WebP, quase quadrada, até 2 MB.',
  },
  banner: {
    folder: 'banners',
    maxBytes: 3 * 1024 * 1024,
    minWidth: 1000,
    minHeight: 350,
    minRatio: 1.8,
    maxRatio: 3.3,
    recommended: '1600 × 600 px',
    description: 'Imagem horizontal em JPG, PNG ou WebP, até 3 MB.',
  },
  logo: {
    folder: 'logos',
    maxBytes: 2 * 1024 * 1024,
    minWidth: 500,
    minHeight: 500,
    minRatio: 0.75,
    maxRatio: 1.33,
    recommended: '1200 × 1200 px',
    description: 'PNG, JPG ou WebP, quase quadrada, até 2 MB.',
  },
};

const BUCKET = 'app-images';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getExtension(name: string | undefined, mimeType: string): string {
  const byName = name?.split('.').pop()?.toLowerCase();
  if (byName && ['jpg', 'jpeg', 'png', 'webp'].includes(byName)) {
    return byName === 'jpeg' ? 'jpg' : byName;
  }
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function getDimensions(uri: string, file?: any): Promise<{ width: number; height: number }> {
  if (Platform.OS === 'web' && (globalThis as any).Image) {
    return new Promise((resolve, reject) => {
      const image = new (globalThis as any).Image();
      const BrowserURL = (globalThis as any).URL;
      const objectUrl = file && BrowserURL ? BrowserURL.createObjectURL(file) : null;
      image.onload = () => {
        const width = Number(image.naturalWidth || image.width);
        const height = Number(image.naturalHeight || image.height);
        if (objectUrl && BrowserURL) BrowserURL.revokeObjectURL(objectUrl);
        resolve({ width, height });
      };
      image.onerror = () => {
        if (objectUrl && BrowserURL) BrowserURL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível ler as dimensões da imagem selecionada.'));
      };
      image.src = objectUrl || uri;
    });
  }

  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error || new Error('Não foi possível ler as dimensões da imagem.'))
    );
  });
}

function inferMimeType(name: string | undefined): string {
  const extension = name?.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return '';
}

function safeFileName(name: string | undefined): string {
  return (name || 'imagem')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function assertAdminSession() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Sua sessão expirou. Entre novamente no painel administrativo.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (profileError) throw new Error(`Não foi possível confirmar seu acesso de administrador: ${profileError.message}`);
  if (profile?.role !== 'admin' || profile?.active === false) {
    throw new Error('Apenas administradores ativos podem enviar imagens.');
  }
}

export const mediaService = {
  async pickAndUpload(kind: AdminImageKind): Promise<{
    publicUrl: string;
    width: number;
    height: number;
    sizeBytes: number;
  } | null> {
    await assertAdminSession();

    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'web' ? 'image/*' : ALLOWED_MIME_TYPES,
      copyToCacheDirectory: Platform.OS !== 'web',
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0] as any;
    const file = Platform.OS === 'web' ? asset.file : undefined;
    const mimeType = asset.mimeType || file?.type || inferMimeType(asset.name);
    const rule = ADMIN_IMAGE_RULES[kind];

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error('Formato inválido. Use somente JPG, PNG ou WebP.');
    }

    let uploadBody: any;
    if (file) {
      uploadBody = file;
    } else {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Não foi possível ler o arquivo selecionado.');
      uploadBody = await response.arrayBuffer();
    }

    const sizeBytes = Number(asset.size ?? file?.size ?? (uploadBody instanceof ArrayBuffer ? uploadBody.byteLength : 0));
    if (!sizeBytes) throw new Error('Não foi possível identificar o tamanho do arquivo.');
    if (sizeBytes > rule.maxBytes) {
      throw new Error(`Arquivo muito grande. O limite é ${(rule.maxBytes / 1024 / 1024).toFixed(0)} MB.`);
    }

    const { width, height } = await getDimensions(asset.uri, file);
    const ratio = width / height;

    if (width < rule.minWidth || height < rule.minHeight) {
      throw new Error(
        `Imagem pequena demais (${width} × ${height} px). Use no mínimo ${rule.minWidth} × ${rule.minHeight} px. Recomendado: ${rule.recommended}.`
      );
    }

    if (ratio < rule.minRatio || ratio > rule.maxRatio) {
      const expected = kind === 'banner' ? 'horizontal' : 'mais próxima do formato quadrado';
      throw new Error(
        `Proporção inadequada (${width} × ${height} px). Escolha uma imagem ${expected}. Recomendado: ${rule.recommended}.`
      );
    }

    const extension = getExtension(asset.name, mimeType);
    const cleanName = safeFileName(asset.name).replace(/\.[^.]+$/, '') || 'imagem';
    const path = `${rule.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${cleanName}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, uploadBody, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
        throw new Error('O armazenamento de imagens não está ativo. Execute o SQL 004 no Supabase.');
      }
      if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('unauthorized')) {
        throw new Error('O Supabase bloqueou o envio da imagem. Execute o SQL 004 e entre novamente no painel como administrador.');
      }
      throw new Error(`Falha ao enviar imagem: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, width, height, sizeBytes };
  },
};
