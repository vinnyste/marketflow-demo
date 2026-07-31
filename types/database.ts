export type UserRole = 'customer' | 'operator' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'weighing'
  | 'weighed'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refused';

export type PaymentMethod = 'pix' | 'debit_card' | 'credit_card' | 'food_voucher' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type ProductUnit = 'un' | 'kg' | 'L' | 'g' | 'ml';
export type DeliveryType = 'delivery' | 'pickup';
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjustment' | 'refund' | 'expired';
export type LoyaltyTransactionStatus = 'active' | 'partially_used' | 'used' | 'expired' | 'refunded';
export type LoyaltyRewardType = 'discount_flat' | 'discount_percent' | 'free_product' | 'custom';
export type LoyaltyRedemptionStatus = 'active' | 'used' | 'expired';
export type LoyaltyMode = 'per_order' | 'per_value';
export type NotificationTarget = 'all' | 'selected';
export type NotificationStatus = 'draft' | 'scheduled' | 'sent';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  active: boolean;
  birth_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  group_name: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  unit: ProductUnit;
  sold_by_weight: boolean;
  min_weight_kg: number | null;
  stock_quantity: number;
  barcode: string | null;
  active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
  reference: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  address_id: string | null;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_type: DeliveryType;
  change_for: number | null;
  notes: string | null;
  estimated_delivery: string | null;
  wants_cpf_on_invoice: boolean;
  invoice_cpf: string | null;
  estimated_min_minutes: number | null;
  estimated_max_minutes: number | null;
  estimated_ready_at: string | null;
  created_at: string;
  updated_at: string;
  address?: Address | null;
  items?: OrderItem[];
  profile?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sold_by_weight: boolean;
  weight_kg: number | null;
  notes: string | null;
  requested_weight: number | null;
  actual_weight: number | null;
  price_per_kg_snapshot: number | null;
  estimated_total: number | null;
  final_total: number | null;
  weighed_at: string | null;
  weighed_by: string | null;
  product?: Product;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface StoreSetting {
  id: string;
  key: string;
  value: string;
  label: string;
  description: string | null;
  updated_at: string;
}

export interface LoyaltyAccount {
  id: string;
  customer_id: string;
  points_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  order_id: string | null;
  type: LoyaltyTransactionType;
  points: number;
  description: string;
  created_at: string;
  expires_at: string | null;
  remaining_points: number | null;
  transaction_status: LoyaltyTransactionStatus | null;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  reward_type: LoyaltyRewardType;
  reward_value: number | null;
  reward_product_id: string | null;
  valid_until: string | null;
  quantity_available: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  reward_product?: Product;
}

export interface LoyaltyRedemption {
  id: string;
  customer_id: string;
  reward_id: string;
  points_spent: number;
  coupon_code: string;
  status: LoyaltyRedemptionStatus;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  reward?: LoyaltyReward;
}

export interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link: string | null;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  product_id: string | null;
  promotional_price: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  target: NotificationTarget;
  target_user_ids: string[] | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: NotificationStatus;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  neighborhood: string;
  city: string | null;
  state: string | null;
  zone_name: string | null;
  delivery_fee: number;
  active: boolean;
  estimated_minutes: number;
  min_delivery_minutes: number | null;
  max_delivery_minutes: number | null;
  free_delivery_above: number | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorPermissions {
  id: string;
  operator_id: string;
  can_accept_orders: boolean;
  can_refuse_orders: boolean;
  can_cancel_orders: boolean;
  can_change_eta: boolean;
  can_weigh_items: boolean;
  can_mark_ready: boolean;
  can_complete_delivery: boolean;
  can_complete_pickup: boolean;
  can_remove_unavailable_item: boolean;
  can_propose_substitution: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  order_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  reason: string | null;
  created_at: string;
}

export interface OperatorContactLog {
  id: string;
  order_id: string;
  operator_id: string;
  reason: string;
  note: string | null;
  created_at: string;
}

type SupabaseTable<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      user_profiles: SupabaseTable<Profile, Partial<Profile> & { id: string }>;
      categories: SupabaseTable<Category>;
      products: SupabaseTable<Product>;
      addresses: SupabaseTable<Address>;
      orders: SupabaseTable<Order>;
      order_items: SupabaseTable<OrderItem>;
      cart_items: SupabaseTable<CartItem>;
      order_status_history: SupabaseTable<OrderStatusHistory>;
      store_settings: SupabaseTable<StoreSetting>;
      delivery_zones: SupabaseTable<DeliveryZone>;
      banners: SupabaseTable<Banner>;
      promotions: SupabaseTable<Promotion>;
      notification_messages: SupabaseTable<NotificationMessage>;
      loyalty_accounts: SupabaseTable<LoyaltyAccount>;
      loyalty_transactions: SupabaseTable<LoyaltyTransaction>;
      loyalty_rewards: SupabaseTable<LoyaltyReward>;
      loyalty_redemptions: SupabaseTable<LoyaltyRedemption>;
      operator_permissions: SupabaseTable<OperatorPermissions>;
      audit_log: SupabaseTable<AuditLog>;
      operator_contact_log: SupabaseTable<OperatorContactLog>;
    };
    Views: Record<string, never>;
    Functions: {
      ensure_own_profile: {
        Args: Record<PropertyKey, never>;
        Returns: (Profile & Record<string, unknown>)[];
      };
      admin_set_user_role_by_email: {
        Args: { p_email: string; p_role: UserRole };
        Returns: { error?: string; success?: boolean };
      };
      award_loyalty_points: {
        Args: {
          p_order_id: string;
          p_customer_id: string;
          p_order_total: number;
          p_brl_per_point?: number;
          p_min_order?: number;
          p_mode?: string;
          p_points_per_order?: number;
        };
        Returns: number;
      };
      adjust_loyalty_points: {
        Args: { p_customer_id: string; p_points: number; p_description: string };
        Returns: undefined;
      };
      redeem_loyalty_reward: {
        Args: { p_customer_id: string; p_reward_id: string };
        Returns: {
          coupon_code: string;
          reward_name: string;
          expires_at: string;
          redemption_id: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
