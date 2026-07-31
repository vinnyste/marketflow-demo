import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '@/constants/theme';

interface Props {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ message, size = 'large', color = Colors.primary, fullScreen = false }: Props) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
