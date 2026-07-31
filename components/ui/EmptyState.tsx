import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  Package, Receipt, ShoppingBag, Star, AlertCircle, Search,
  Inbox, FileText, Users, LucideIcon,
} from 'lucide-react-native';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { Button } from './Button';

// Map legacy icon names to Lucide components.
const ICON_MAP: Record<string, LucideIcon> = {
  'receipt-long': Receipt,
  'receipt': Receipt,
  'shopping-bag': ShoppingBag,
  'inventory-2': Package,
  'inventory': Package,
  'package': Package,
  'stars': Star,
  'star': Star,
  'people': Users,
  'search': Search,
  'inbox': Inbox,
  'file-text': FileText,
  'alert-circle': AlertCircle,
};

interface Props {
  title: string;
  subtitle?: string;
  imageSource?: any;
  icon?: string;
  IconComponent?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, imageSource, icon, IconComponent, actionLabel, onAction }: Props) {
  const ResolvedIcon = IconComponent || (icon ? ICON_MAP[icon] : null) || Inbox;

  return (
    <View style={styles.container}>
      {imageSource ? (
        <Image source={imageSource} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.iconContainer}>
          <ResolvedIcon size={64} color={Colors.border} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  image: { width: 160, height: 160 },
  iconContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: { marginTop: Spacing.sm },
});
