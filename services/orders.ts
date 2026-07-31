import { supabase } from '@/lib/supabase';
import { createRealtimeTopic } from '@/lib/realtime';
import { Order, OrderStatus, CartItem } from '@/types/database';

const WEIGHT_EDITABLE_STATUSES: OrderStatus[] = ['confirmed', 'preparing', 'weighing', 'weighed'];

export const ordersService = {
  async getByUser(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, address:addresses(*), items:order_items(*, product:products(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Order[];
  },

  async getById(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, address:addresses(*), items:order_items(*, product:products(*)), profile:user_profiles(*)')
      .eq('id', orderId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('ordersService.getById:', error);
      throw error;
    }
    return data as Order;
  },

  async getAll(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, address:addresses(*), profile:user_profiles(*), items:order_items(*, product:products(*))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Order[];
  },

  async createFromCart(
    userId: string,
    addressId: string | null,
    cartItems: CartItem[],
    paymentMethod: string,
    deliveryFee: number,
    deliveryType: 'delivery' | 'pickup' = 'delivery',
    notes?: string,
    changeFor?: number,
    wantsCpf?: boolean,
    invoiceCpf?: string
  ): Promise<Order> {
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.product?.price || 0) * Number(item.quantity);
    }, 0);
    const total = subtotal + deliveryFee;

    const orderPayload: Record<string, any> = {
      user_id: userId,
      status: 'pending',
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: total,
      payment_method: paymentMethod,
      payment_status: 'pending',
      delivery_type: deliveryType,
      notes: notes || null,
    };

    if (addressId) orderPayload.address_id = addressId;
    if (changeFor !== undefined && changeFor > 0) orderPayload.change_for = changeFor;
    if (wantsCpf) orderPayload.wants_cpf_on_invoice = true;
    if (invoiceCpf) orderPayload.invoice_cpf = invoiceCpf;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = cartItems.map((item) => {
      const unitPrice = item.product?.price || 0;
      const qty = Number(item.quantity);
      const isByWeight = item.product?.sold_by_weight || false;
      const estimated = unitPrice * qty;

      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: qty,
        unit_price: unitPrice,
        total_price: estimated,
        sold_by_weight: isByWeight,
        weight_kg: null,
        // Weight tracking
        requested_weight: isByWeight ? qty : null,
        price_per_kg_snapshot: isByWeight ? unitPrice : null,
        estimated_total: isByWeight ? estimated : null,
        final_total: isByWeight ? null : estimated,
        actual_weight: null,
        weighed_at: null,
        weighed_by: null,
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);
    if (itemsError) throw itemsError;

    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'pending',
      note: `Pedido realizado (${deliveryType === 'pickup' ? 'retirada' : 'entrega'})`,
      changed_by: userId,
    });

    await supabase.from('cart_items').delete().eq('user_id', userId);

    return order as Order;
  },

  async updateStatus(orderId: string, status: OrderStatus, note?: string, adminId?: string) {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status,
      note: note || null,
      changed_by: adminId || null,
    });

    // Award loyalty points when order is completed
    if (status === 'completed' && data) {
      try {
        const { data: settings } = await supabase
          .from('store_settings')
          .select('key, value')
          .in('key', ['loyalty_enabled', 'loyalty_mode', 'loyalty_brl_per_point', 'loyalty_min_order_value', 'loyalty_points_per_order']);
        const settingsMap: Record<string, string> = {};
        (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });
        if (settingsMap['loyalty_enabled'] === 'true') {
          const mode = settingsMap['loyalty_mode'] || 'per_value';
          const brlPerPoint = parseInt(settingsMap['loyalty_brl_per_point'] || '1', 10);
          const minOrder = parseFloat(settingsMap['loyalty_min_order_value'] || '0');
          const pointsPerOrder = parseInt(settingsMap['loyalty_points_per_order'] || '10', 10);
          await supabase.rpc('award_loyalty_points', {
            p_order_id: orderId,
            p_customer_id: data.user_id,
            p_order_total: data.total_amount,
            p_brl_per_point: brlPerPoint,
            p_min_order: minOrder,
            p_mode: mode,
            p_points_per_order: pointsPerOrder,
          });
        }
      } catch (loyaltyErr) {
        // Non-blocking: loyalty errors don't fail the status update
        console.warn('Loyalty points award failed:', loyaltyErr);
      }
    }

    return data;
  },

  async updateItemWeight(
    itemId: string,
    actualWeightKg: number,
    pricePerKgSnapshot: number,
    adminId?: string
  ) {
    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('id', itemId)
      .single();
    if (itemError) throw itemError;
    if (!orderItem?.order_id) throw new Error('Item sem pedido associado.');

    const { data: currentOrder, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderItem.order_id)
      .single();
    if (orderError) throw orderError;
    if (!WEIGHT_EDITABLE_STATUSES.includes(currentOrder.status)) {
      throw new Error('O peso só pode ser alterado durante a preparação ou pesagem do pedido.');
    }

    const finalTotal = actualWeightKg * pricePerKgSnapshot;
    const { data, error } = await supabase
      .from('order_items')
      .update({
        actual_weight: actualWeightKg,
        weight_kg: actualWeightKg,
        final_total: finalTotal,
        total_price: finalTotal,
        weighed_at: new Date().toISOString(),
        weighed_by: adminId || null,
      })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async recalculateTotal(orderId: string) {
    const { data: items } = await supabase
      .from('order_items')
      .select('total_price, sold_by_weight, actual_weight, estimated_total, final_total')
      .eq('order_id', orderId);

    if (!items) return;

    const subtotal = items.reduce((sum, item) => {
      if (item.sold_by_weight) {
        // Use final_total if weighed, else estimated_total
        return sum + (item.final_total ?? item.estimated_total ?? item.total_price ?? 0);
      }
      return sum + (item.total_price ?? 0);
    }, 0);

    const { data: order } = await supabase
      .from('orders')
      .select('delivery_fee')
      .eq('id', orderId)
      .single();

    const total = subtotal + (order?.delivery_fee || 0);

    await supabase
      .from('orders')
      .update({ subtotal, total_amount: total, updated_at: new Date().toISOString() })
      .eq('id', orderId);
  },

  async getStatusHistory(orderId: string) {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  subscribeToOrder(orderId: string, callback: (order: Partial<Order>) => void) {
    return supabase
      .channel(createRealtimeTopic(`order:${orderId}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => callback(payload.new as Partial<Order>)
      )
      .subscribe();
  },

  subscribeToOrderItems(orderId: string, callback: () => void) {
    return supabase
      .channel(createRealtimeTopic(`order_items:${orderId}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` },
        callback
      )
      .subscribe();
  },

  subscribeToAllOrders(callback: (payload: any) => void) {
    return supabase
      .channel(createRealtimeTopic('admin:orders'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        callback
      )
      .subscribe();
  },
};
