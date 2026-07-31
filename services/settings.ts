import { supabase } from '@/lib/supabase';
import { StoreSetting, DeliveryZone } from '@/types/database';

const SETTING_LABELS: Record<string, string> = {
  store_name: 'Nome da loja',
  store_phone: 'Telefone da loja',
  store_whatsapp: 'WhatsApp da loja',
  store_email: 'E-mail da loja',
  store_address: 'Endereço da loja',
  store_logo_url: 'Logo da loja',
  store_open_time: 'Abertura do mercado',
  store_close_time: 'Fechamento do mercado',
  store_open_days: 'Dias de funcionamento',
  delivery_open_time: 'Início das entregas',
  delivery_close_time: 'Fim das entregas',
  pickup_open_time: 'Início das retiradas',
  pickup_close_time: 'Fim das retiradas',
  delivery_enabled: 'Entregas ativas',
  pickup_enabled: 'Retiradas ativas',
  min_order_value: 'Pedido mínimo',
  delivery_min_minutes: 'Prazo mínimo de entrega',
  delivery_max_minutes: 'Prazo máximo de entrega',
  pickup_min_minutes: 'Prazo mínimo de retirada',
  pickup_max_minutes: 'Prazo máximo de retirada',
  pickup_address: 'Endereço de retirada',
  pickup_instructions: 'Instruções de retirada',
  unavailability_message: 'Mensagem de indisponibilidade',
  high_demand_message: 'Mensagem de alta demanda',
  free_delivery_above: 'Entrega grátis acima de',
  loyalty_enabled: 'Clube MarketFlow ativo',
  loyalty_mode: 'Modo do Clube MarketFlow',
  loyalty_brl_per_point: 'Reais por ponto',
  loyalty_points_per_order: 'Pontos por pedido',
  loyalty_min_order_value: 'Pedido mínimo para pontuar',
  loyalty_points_validity_days: 'Validade dos pontos',
};

export const settingsService = {
  async getAll(): Promise<StoreSetting[]> {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .order('key');
    if (error) throw error;
    return data;
  },

  async get(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  },

  async update(key: string, value: string): Promise<StoreSetting> {
    const updatedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('store_settings')
      .update({ value, updated_at: updatedAt })
      .eq('key', key)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (updated) return updated as StoreSetting;

    const { data: created, error: insertError } = await supabase
      .from('store_settings')
      .insert({
        key,
        value,
        label: SETTING_LABELS[key] ?? key,
        description: null,
        updated_at: updatedAt,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return created as StoreSetting;
  },

  async getBusinessHours(): Promise<{
    storeOpen: string; storeClose: string;
    deliveryOpen: string; deliveryClose: string;
    pickupOpen: string; pickupClose: string;
  }> {
    const keys = [
      'store_open_time', 'store_close_time',
      'delivery_open_time', 'delivery_close_time',
      'pickup_open_time', 'pickup_close_time',
    ];
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', keys);
    if (error) throw error;

    const m: Record<string, string> = {};
    (data || []).forEach((r: any) => { m[r.key] = r.value; });
    return {
      storeOpen: m['store_open_time'] ?? '07:00',
      storeClose: m['store_close_time'] ?? '20:00',
      deliveryOpen: m['delivery_open_time'] ?? '08:00',
      deliveryClose: m['delivery_close_time'] ?? '18:00',
      pickupOpen: m['pickup_open_time'] ?? '08:00',
      pickupClose: m['pickup_close_time'] ?? '20:00',
    };
  },

  isWithinHours(openTime: string, closeTime: string): boolean {
    const now = new Date();
    const [oh, om] = openTime.split(':').map(Number);
    const [ch, cm] = closeTime.split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    return nowMin >= openMin && nowMin < closeMin;
  },

  async getDeliveryZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('active', true)
      .order('neighborhood');
    if (error) throw error;
    return data as DeliveryZone[];
  },

  findZoneByNeighborhood(zones: DeliveryZone[], neighborhood: string): DeliveryZone | null {
    const norm = neighborhood.toLowerCase().trim();
    return zones.find((z) => z.neighborhood.toLowerCase().trim() === norm) ?? null;
  },
};
