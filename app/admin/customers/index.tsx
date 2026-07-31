import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput } from 'react-native';
import { Search, Star, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { loyaltyService } from '@/services/loyalty';
import { Profile } from '@/types/database';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function AdminCustomersScreen() {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loyaltyMap, setLoyaltyMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    const [profilesRes, loyaltyAccounts] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false }),
      loyaltyService.getAllAccounts().catch(() => []),
    ]);
    if (!profilesRes.error) setCustomers(profilesRes.data || []);
    const lMap: Record<string, number> = {};
    loyaltyAccounts.forEach((a: any) => { lMap[a.customer_id] = a.points_balance; });
    setLoyaltyMap(lMap);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) =>
    search
      ? c.full_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
      : true
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando clientes..." />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.adminTextMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou telefone..."
            placeholderTextColor={Colors.adminTextMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>
      <Text style={styles.count}>{filtered.length} clientes cadastrados</Text>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum cliente" subtitle="Clientes aparecerão aqui após se cadastrarem" IconComponent={Users} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.full_name || 'C')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.full_name || 'Sem nome'}</Text>
                {item.email ? <Text style={styles.phone}>{item.email}</Text> : null}
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
                <Text style={styles.date}>Cadastrado em {formatDate(item.created_at)}</Text>
              </View>
              {loyaltyMap[item.id] !== undefined ? (
                <View style={styles.pointsBadge}>
                  <Star size={12} color={Colors.primary} fill={Colors.primary} />
                  <Text style={styles.pointsText}>{loyaltyMap[item.id]}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBackground },
  topBar: { padding: Spacing.lg, paddingBottom: 0 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.adminSurface, paddingHorizontal: Spacing.md, height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.adminText },
  count: { fontSize: FontSize.sm, color: Colors.adminTextMuted, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  avatar: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  phone: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  date: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primarySurface, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  pointsText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
});
