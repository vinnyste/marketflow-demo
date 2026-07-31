import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderStatus } from '@/types/database';
import { Colors, Radius, FontSize, FontWeight } from '@/constants/theme';

const STATUS_MAP: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Aguardando', color: Colors.statusPending, bg: Colors.warningSurface },
  confirmed: { label: 'Confirmado', color: Colors.statusConfirmed, bg: Colors.infoSurface },
  preparing: { label: 'Preparando', color: Colors.statusPreparing, bg: '#F3E5F5' },
  weighing: { label: 'Pesagem', color: '#D4840A', bg: '#FFF3E0' },
  weighed: { label: 'Pesado', color: '#7B5EA7', bg: '#F3E5F5' },
  ready: { label: 'Pronto', color: '#1565C0', bg: '#E3F2FD' },
  out_for_delivery: { label: 'A caminho', color: Colors.statusOutForDelivery, bg: '#E0F7FA' },
  delivered: { label: 'Entregue', color: Colors.statusDelivered, bg: Colors.successSurface },
  completed: { label: 'Concluído', color: Colors.success, bg: Colors.successSurface },
  cancelled: { label: 'Cancelado', color: Colors.statusCancelled, bg: Colors.errorSurface },
  refused: { label: 'Recusado', color: Colors.error, bg: Colors.errorSurface },
};

interface Props {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export function OrderStatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_MAP[status] || STATUS_MAP.pending;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.sm]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, size === 'sm' && styles.textSm]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  textSm: { fontSize: FontSize.xs },
});
