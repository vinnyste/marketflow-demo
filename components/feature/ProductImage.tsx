import React, { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';

const MIGNON_IMAGES = {
  beef: require('../../assets/images/products/mignon/file-mignon-bovino.png'),
  medallions: require('../../assets/images/products/mignon/medalhoes-file-mignon-4un.png'),
  pork: require('../../assets/images/products/mignon/file-mignon-suino.png'),
  skewers: require('../../assets/images/products/mignon/espetinho-xixo-mignon.png'),
  zezeCalabresa: require('../../assets/images/products/mignon/zeze-mignon-calabresa-60g.png'),
  zezeChurrasco: require('../../assets/images/products/mignon/zeze-mignon-churrasco-60g.png'),
  zezeGaleto: require('../../assets/images/products/mignon/zeze-mignon-galeto-60g.png'),
  zezeOriginal: require('../../assets/images/products/mignon/zeze-mignon-original-60g.png'),
  zezeQueijo: require('../../assets/images/products/mignon/zeze-mignon-queijo-60g.png'),
};

function normalizeProductName(productName?: string) {
  return (productName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getProductFallback(productName?: string) {
  const name = normalizeProductName(productName);

  if (name.includes('BISCOITO MIGNON')) {
    if (name.includes('CALABRESA')) return MIGNON_IMAGES.zezeCalabresa;
    if (name.includes('CHURRASCO')) return MIGNON_IMAGES.zezeChurrasco;
    if (name.includes('GALETO')) return MIGNON_IMAGES.zezeGaleto;
    if (name.includes('ORIGINAL')) return MIGNON_IMAGES.zezeOriginal;
    if (name.includes('QUEIJO')) return MIGNON_IMAGES.zezeQueijo;

    return null;
  }

  if (!name.includes('MIGNON')) return null;
  if (name.includes('SUINO')) return MIGNON_IMAGES.pork;
  if (!name.includes('BOVINO')) return null;
  if (name.includes('MEDALHAO')) return MIGNON_IMAGES.medallions;
  if (name.includes('ESPETINHO') || name.includes('XIXO')) return MIGNON_IMAGES.skewers;

  return MIGNON_IMAGES.beef;
}

type Props = {
  imageUrl?: string | null;
  productName?: string;
  style: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transition?: number;
};

export function ProductImage({
  imageUrl,
  productName,
  style,
  contentFit = 'cover',
  transition = 200,
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const source = imageUrl && !failed ? { uri: imageUrl } : getProductFallback(productName);

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={transition}
      onError={() => setFailed(true)}
      accessibilityLabel={
        source
          ? `Imagem do produto ${productName || ''}`.trim()
          : `Sem imagem cadastrada para ${productName || 'produto'}`
      }
    />
  );
}
