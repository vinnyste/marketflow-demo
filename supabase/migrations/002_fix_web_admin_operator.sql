-- ============================================================================
-- MarketFlow Demo — correção consolidada do painel Web / Operadores / Delivery
-- Idempotente: pode ser executada mais de uma vez no Supabase SQL Editor.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------------------------------
-- 1) PERFIS: tabela usada pelo aplicativo atual
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.user_profiles SET role = 'customer' WHERE role IS NULL OR role NOT IN ('customer','operator','admin');
UPDATE public.user_profiles SET active = TRUE WHERE active IS NULL;
UPDATE public.user_profiles SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.user_profiles SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'customer';
ALTER TABLE public.user_profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN active SET DEFAULT TRUE;
ALTER TABLE public.user_profiles ALTER COLUMN active SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.user_profiles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE public.user_profiles ALTER COLUMN updated_at SET NOT NULL;

-- Garante um user_profiles para todo usuário do Supabase Auth, inclusive contas
-- criadas enquanto o trigger antigo ainda escrevia somente em public.profiles.
INSERT INTO public.user_profiles (
  id, email, full_name, phone, birth_date, role, active, created_at, updated_at
)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  NULLIF(u.raw_user_meta_data->>'phone', ''),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN (u.raw_user_meta_data->>'birth_date')::date
    ELSE NULL
  END,
  'customer',
  TRUE,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(EXCLUDED.email, public.user_profiles.email),
  full_name = COALESCE(NULLIF(public.user_profiles.full_name, ''), NULLIF(EXCLUDED.full_name, ''), ''),
  phone = COALESCE(public.user_profiles.phone, EXCLUDED.phone),
  birth_date = COALESCE(public.user_profiles.birth_date, EXCLUDED.birth_date),
  updated_at = NOW();

-- Migra dados da antiga tabela "profiles", caso o projeto tenha começado pelo
-- schema inicial antigo.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id, email, full_name, phone, avatar_url, role, active, created_at, updated_at
    )
    SELECT
      p.id,
      u.email,
      p.full_name,
      p.phone,
      p.avatar_url,
      CASE WHEN p.role IN ('customer', 'operator', 'admin') THEN p.role ELSE 'customer' END,
      TRUE,
      COALESCE(p.created_at, NOW()),
      COALESCE(p.updated_at, NOW())
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, public.user_profiles.email),
      full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
      phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
      role = CASE
        WHEN public.user_profiles.role = 'customer' THEN EXCLUDED.role
        ELSE public.user_profiles.role
      END,
      updated_at = NOW();
  END IF;
END $$;

UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR lower(p.email) <> lower(u.email));

-- Corrige exatamente o erro user_profiles_role_check mostrado no Console.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('customer', 'operator', 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_lower_uidx
  ON public.user_profiles (lower(email))
  WHERE email IS NOT NULL;

-- Novo cadastro sempre cria user_profiles, com e-mail e função segura.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name, phone, birth_date, role, active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
      ELSE NULL
    END,
    'customer',
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone),
    birth_date = COALESCE(EXCLUDED.birth_date, public.user_profiles.birth_date),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- 2) COLUNAS DO FLUXO ATUAL DE PEDIDOS/PESAGEM
-- --------------------------------------------------------------------------
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'delivery';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_for NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wants_cpf_on_invoice BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_cpf TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_min_minutes INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_max_minutes INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending','confirmed','preparing','weighing','weighed','ready',
      'out_for_delivery','delivered','completed','cancelled','refused'
    )
  ) NOT VALID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('pix','debit_card','credit_card','food_voucher','cash','card')
  ) NOT VALID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_type_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_type_check CHECK (delivery_type IN ('delivery','pickup')) NOT VALID;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS requested_weight NUMERIC(10,3);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS actual_weight NUMERIC(10,3);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_per_kg_snapshot NUMERIC(10,2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS estimated_total NUMERIC(10,2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS final_total NUMERIC(10,2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS weighed_at TIMESTAMPTZ;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS weighed_by UUID;

-- Ajusta FKs de tabelas antigas que ainda apontam para public.profiles.
-- As novas constraints são NOT VALID: passam a proteger novas gravações sem
-- bloquear a correção por causa de algum registro legado órfão.
DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    FOR c IN
      SELECT conrelid::regclass AS tbl, conname
      FROM pg_constraint
      WHERE contype = 'f'
        AND confrelid = to_regclass('public.profiles')
        AND conrelid IN (
          to_regclass('public.addresses'),
          to_regclass('public.orders'),
          to_regclass('public.cart_items'),
          to_regclass('public.order_status_history')
        )
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    END LOOP;
  END IF;

  IF to_regclass('public.addresses') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.addresses')
      AND contype = 'f' AND confrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.orders')
      AND contype = 'f' AND confrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT NOT VALID;
  END IF;

  IF to_regclass('public.cart_items') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.cart_items')
      AND contype = 'f' AND confrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_user_id_user_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.order_status_history') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.order_status_history')
      AND contype = 'f' AND confrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.order_status_history
      ADD CONSTRAINT order_status_history_changed_by_user_profiles_fkey
      FOREIGN KEY (changed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 3) DELIVERY / OPERADORES / AUDITORIA
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  neighborhood TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zone_name TEXT,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_minutes INTEGER NOT NULL DEFAULT 45,
  min_delivery_minutes INTEGER,
  max_delivery_minutes INTEGER,
  free_delivery_above NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS zone_name TEXT;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 45;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS min_delivery_minutes INTEGER;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS max_delivery_minutes INTEGER;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10,2);
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE public.delivery_zones
SET neighborhood = COALESCE(NULLIF(neighborhood, ''), NULLIF(zone_name, ''))
WHERE neighborhood IS NULL OR neighborhood = '';

CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_neighborhood_city_uidx
  ON public.delivery_zones (lower(neighborhood), lower(COALESCE(city, '')))
  WHERE neighborhood IS NOT NULL AND neighborhood <> '';

CREATE TABLE IF NOT EXISTS public.operator_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  can_accept_orders BOOLEAN NOT NULL DEFAULT TRUE,
  can_refuse_orders BOOLEAN NOT NULL DEFAULT FALSE,
  can_cancel_orders BOOLEAN NOT NULL DEFAULT FALSE,
  can_change_eta BOOLEAN NOT NULL DEFAULT TRUE,
  can_weigh_items BOOLEAN NOT NULL DEFAULT TRUE,
  can_mark_ready BOOLEAN NOT NULL DEFAULT TRUE,
  can_complete_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  can_complete_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  can_remove_unavailable_item BOOLEAN NOT NULL DEFAULT TRUE,
  can_propose_substitution BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_accept_orders BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_refuse_orders BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_cancel_orders BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_change_eta BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_weigh_items BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_mark_ready BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_complete_delivery BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_complete_pickup BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_remove_unavailable_item BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS can_propose_substitution BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS granted_by UUID;
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.operator_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS operator_permissions_operator_id_uidx
  ON public.operator_permissions(operator_id);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.operator_contact_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 4) TABELAS AUXILIARES QUE O PAINEL ATUAL UTILIZA
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  promotional_price NUMERIC(10,2) NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all','selected')),
  target_user_ids UUID[],
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earn','redeem','adjustment','refund','expired')),
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  remaining_points INTEGER,
  transaction_status TEXT CHECK (transaction_status IN ('active','partially_used','used','expired','refunded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_earn_per_order_uidx
  ON public.loyalty_transactions(order_id)
  WHERE order_id IS NOT NULL AND type = 'earn';

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_flat','discount_percent','free_product','custom')),
  reward_value NUMERIC(10,2),
  reward_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  valid_until TIMESTAMPTZ,
  quantity_available INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL,
  coupon_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 5) CONFIGURAÇÕES PADRÃO (update do app também cria chave ausente)
-- --------------------------------------------------------------------------
INSERT INTO public.store_settings (key, value, label, description)
VALUES
  ('store_name', 'MarketFlow Demo', 'Nome da loja', NULL),
  ('store_phone', '', 'Telefone da loja', NULL),
  ('store_whatsapp', '', 'WhatsApp da loja', NULL),
  ('store_email', '', 'E-mail da loja', NULL),
  ('store_address', '', 'Endereço da loja', NULL),
  ('store_logo_url', '', 'Logo da loja', NULL),
  ('store_open_time', '07:00', 'Abertura do mercado', NULL),
  ('store_close_time', '20:00', 'Fechamento do mercado', NULL),
  ('store_open_days', '1,2,3,4,5,6', 'Dias de funcionamento', NULL),
  ('delivery_open_time', '08:00', 'Início das entregas', NULL),
  ('delivery_close_time', '18:00', 'Fim das entregas', NULL),
  ('pickup_open_time', '08:00', 'Início das retiradas', NULL),
  ('pickup_close_time', '20:00', 'Fim das retiradas', NULL),
  ('delivery_enabled', 'true', 'Entregas ativas', NULL),
  ('pickup_enabled', 'true', 'Retiradas ativas', NULL),
  ('min_order_value', '0', 'Pedido mínimo', NULL),
  ('delivery_min_minutes', '45', 'Prazo mínimo de entrega', NULL),
  ('delivery_max_minutes', '60', 'Prazo máximo de entrega', NULL),
  ('pickup_min_minutes', '20', 'Prazo mínimo de retirada', NULL),
  ('pickup_max_minutes', '40', 'Prazo máximo de retirada', NULL),
  ('pickup_address', '', 'Endereço de retirada', NULL),
  ('pickup_instructions', '', 'Instruções de retirada', NULL),
  ('unavailability_message', '', 'Mensagem de indisponibilidade', NULL),
  ('high_demand_message', '', 'Mensagem de alta demanda', NULL),
  ('free_delivery_above', '0', 'Entrega grátis acima de', NULL),
  ('loyalty_enabled', 'false', 'Fidelidade ativa', NULL),
  ('loyalty_mode', 'per_value', 'Modo de fidelidade', NULL),
  ('loyalty_brl_per_point', '1', 'Reais por ponto', NULL),
  ('loyalty_points_per_order', '10', 'Pontos por pedido', NULL),
  ('loyalty_min_order_value', '0', 'Pedido mínimo para pontuar', NULL),
  ('loyalty_points_validity_days', '365', 'Validade dos pontos', NULL)
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------------------
-- 6) FUNÇÕES DE AUTORIZAÇÃO E RPC DE OPERADOR
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('operator','admin') AND active = TRUE
  );
$$;

DROP FUNCTION IF EXISTS public.admin_set_user_role_by_email(TEXT, TEXT);
CREATE FUNCTION public.admin_set_user_role_by_email(
  p_email TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.user_profiles%ROWTYPE;
  v_old_role TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Apenas administradores podem alterar funções.');
  END IF;

  IF p_role NOT IN ('customer','operator','admin') THEN
    RETURN jsonb_build_object('error', 'Função inválida.');
  END IF;

  SELECT * INTO v_target
  FROM public.user_profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado.');
  END IF;

  IF v_target.id = auth.uid() AND p_role <> 'admin' THEN
    RETURN jsonb_build_object('error', 'O administrador não pode remover a própria permissão.');
  END IF;

  v_old_role := v_target.role;

  UPDATE public.user_profiles
  SET role = p_role, active = TRUE, updated_at = NOW()
  WHERE id = v_target.id;

  IF p_role = 'operator' THEN
    INSERT INTO public.operator_permissions (operator_id, granted_by)
    VALUES (v_target.id, auth.uid())
    ON CONFLICT (operator_id) DO UPDATE SET
      granted_by = EXCLUDED.granted_by,
      updated_at = NOW();
  ELSIF v_old_role = 'operator' THEN
    DELETE FROM public.operator_permissions WHERE operator_id = v_target.id;
  END IF;

  INSERT INTO public.audit_log (
    user_id, role, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    auth.uid(), 'admin', 'set_user_role', 'user_profiles', v_target.id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_target.id,
    'old_role', v_old_role,
    'new_role', p_role
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- --------------------------------------------------------------------------
-- 7) RPCs DE FIDELIDADE
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_order_id UUID,
  p_customer_id UUID,
  p_order_total NUMERIC,
  p_brl_per_point INTEGER DEFAULT 1,
  p_min_order NUMERIC DEFAULT 0,
  p_mode TEXT DEFAULT 'per_value',
  p_points_per_order INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_points INTEGER;
BEGIN
  IF NOT public.is_operator() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND type = 'earn'
  ) THEN
    RETURN 0;
  END IF;

  IF p_order_total < COALESCE(p_min_order, 0) THEN
    RETURN 0;
  END IF;

  IF p_mode = 'per_order' THEN
    v_points := GREATEST(COALESCE(p_points_per_order, 0), 0);
  ELSE
    v_points := FLOOR(p_order_total / GREATEST(COALESCE(p_brl_per_point, 1), 1));
  END IF;

  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.loyalty_accounts (customer_id, points_balance)
  VALUES (p_customer_id, v_points)
  ON CONFLICT (customer_id) DO UPDATE SET
    points_balance = public.loyalty_accounts.points_balance + EXCLUDED.points_balance,
    updated_at = NOW();

  INSERT INTO public.loyalty_transactions (
    customer_id, order_id, type, points, description, remaining_points, transaction_status
  ) VALUES (
    p_customer_id, p_order_id, 'earn', v_points,
    'Pontos do pedido', v_points, 'active'
  );

  RETURN v_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_loyalty_points(
  p_customer_id UUID,
  p_points INTEGER,
  p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current INTEGER;
  v_next INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  INSERT INTO public.loyalty_accounts (customer_id, points_balance)
  VALUES (p_customer_id, 0)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT points_balance INTO v_current
  FROM public.loyalty_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  v_next := GREATEST(v_current + p_points, 0);

  UPDATE public.loyalty_accounts
  SET points_balance = v_next, updated_at = NOW()
  WHERE customer_id = p_customer_id;

  INSERT INTO public.loyalty_transactions (
    customer_id, type, points, description, remaining_points, transaction_status
  ) VALUES (
    p_customer_id, 'adjustment', v_next - v_current,
    COALESCE(NULLIF(p_description, ''), 'Ajuste manual'),
    ABS(v_next - v_current), 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_customer_id UUID,
  p_reward_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.loyalty_accounts%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_redemption_id UUID;
  v_coupon TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_customer_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_reward
  FROM public.loyalty_rewards
  WHERE id = p_reward_id AND active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Recompensa indisponível'; END IF;
  IF v_reward.valid_until IS NOT NULL AND v_reward.valid_until < NOW() THEN
    RAISE EXCEPTION 'Recompensa expirada';
  END IF;
  IF v_reward.quantity_available IS NOT NULL AND v_reward.quantity_available <= 0 THEN
    RAISE EXCEPTION 'Recompensa esgotada';
  END IF;

  SELECT * INTO v_account
  FROM public.loyalty_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND OR v_account.points_balance < v_reward.points_required THEN
    RAISE EXCEPTION 'Saldo de pontos insuficiente';
  END IF;

  v_coupon := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_expires := LEAST(
    COALESCE(v_reward.valid_until, NOW() + INTERVAL '30 days'),
    NOW() + INTERVAL '30 days'
  );

  UPDATE public.loyalty_accounts
  SET points_balance = points_balance - v_reward.points_required, updated_at = NOW()
  WHERE customer_id = p_customer_id;

  INSERT INTO public.loyalty_redemptions (
    customer_id, reward_id, points_spent, coupon_code, status, expires_at
  ) VALUES (
    p_customer_id, p_reward_id, v_reward.points_required, v_coupon, 'active', v_expires
  ) RETURNING id INTO v_redemption_id;

  INSERT INTO public.loyalty_transactions (
    customer_id, type, points, description, remaining_points, transaction_status
  ) VALUES (
    p_customer_id, 'redeem', -v_reward.points_required,
    'Resgate: ' || v_reward.name, 0, 'used'
  );

  IF v_reward.quantity_available IS NOT NULL THEN
    UPDATE public.loyalty_rewards
    SET quantity_available = quantity_available - 1, updated_at = NOW()
    WHERE id = v_reward.id;
  END IF;

  RETURN jsonb_build_object(
    'coupon_code', v_coupon,
    'reward_name', v_reward.name,
    'expires_at', v_expires,
    'redemption_id', v_redemption_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_operator() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role_by_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(UUID, UUID, NUMERIC, INTEGER, NUMERIC, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_loyalty_points(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(UUID, UUID) TO authenticated;

-- --------------------------------------------------------------------------
-- 8) RLS: clientes veem o próprio; operadores veem o operacional; admin gerencia
-- --------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_contact_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketflow_profiles_select" ON public.user_profiles;
CREATE POLICY "marketflow_profiles_select" ON public.user_profiles
FOR SELECT USING (auth.uid() = id OR public.is_operator());

DROP POLICY IF EXISTS "marketflow_profiles_update_own_or_admin" ON public.user_profiles;
CREATE POLICY "marketflow_profiles_update_own_or_admin" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Bloqueia alteração direta da coluna role; promoção ocorre somente pelo RPC.
REVOKE UPDATE ON TABLE public.user_profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, birth_date, active, updated_at)
  ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;

DROP POLICY IF EXISTS "marketflow_delivery_zones_read" ON public.delivery_zones;
CREATE POLICY "marketflow_delivery_zones_read" ON public.delivery_zones
FOR SELECT USING (active = TRUE OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_delivery_zones_admin" ON public.delivery_zones;
CREATE POLICY "marketflow_delivery_zones_admin" ON public.delivery_zones
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "marketflow_operator_permissions_read" ON public.operator_permissions;
CREATE POLICY "marketflow_operator_permissions_read" ON public.operator_permissions
FOR SELECT USING (operator_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_operator_permissions_admin" ON public.operator_permissions;
CREATE POLICY "marketflow_operator_permissions_admin" ON public.operator_permissions
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "marketflow_audit_insert" ON public.audit_log;
CREATE POLICY "marketflow_audit_insert" ON public.audit_log
FOR INSERT WITH CHECK (public.is_operator());
DROP POLICY IF EXISTS "marketflow_audit_admin_read" ON public.audit_log;
CREATE POLICY "marketflow_audit_admin_read" ON public.audit_log
FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "marketflow_contact_operator" ON public.operator_contact_log;
CREATE POLICY "marketflow_contact_operator" ON public.operator_contact_log
FOR ALL USING (public.is_operator()) WITH CHECK (public.is_operator());

-- Políticas adicionais nas tabelas operacionais já existentes.
DROP POLICY IF EXISTS "marketflow_operator_orders_select" ON public.orders;
CREATE POLICY "marketflow_operator_orders_select" ON public.orders
FOR SELECT USING (public.is_operator());
DROP POLICY IF EXISTS "marketflow_operator_orders_update" ON public.orders;
CREATE POLICY "marketflow_operator_orders_update" ON public.orders
FOR UPDATE USING (public.is_operator()) WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "marketflow_operator_items_select" ON public.order_items;
CREATE POLICY "marketflow_operator_items_select" ON public.order_items
FOR SELECT USING (public.is_operator());
DROP POLICY IF EXISTS "marketflow_operator_items_update" ON public.order_items;
CREATE POLICY "marketflow_operator_items_update" ON public.order_items
FOR UPDATE USING (public.is_operator()) WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "marketflow_operator_history_select" ON public.order_status_history;
CREATE POLICY "marketflow_operator_history_select" ON public.order_status_history
FOR SELECT USING (public.is_operator());
DROP POLICY IF EXISTS "marketflow_operator_history_insert" ON public.order_status_history;
CREATE POLICY "marketflow_operator_history_insert" ON public.order_status_history
FOR INSERT WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "marketflow_operator_addresses_select" ON public.addresses;
CREATE POLICY "marketflow_operator_addresses_select" ON public.addresses
FOR SELECT USING (public.is_operator());

DROP POLICY IF EXISTS "marketflow_banners_public" ON public.banners;
CREATE POLICY "marketflow_banners_public" ON public.banners
FOR SELECT USING (active = TRUE OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_banners_admin" ON public.banners;
CREATE POLICY "marketflow_banners_admin" ON public.banners
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "marketflow_promotions_public" ON public.promotions;
CREATE POLICY "marketflow_promotions_public" ON public.promotions
FOR SELECT USING (active = TRUE OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_promotions_admin" ON public.promotions;
CREATE POLICY "marketflow_promotions_admin" ON public.promotions
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "marketflow_notifications_admin" ON public.notification_messages;
CREATE POLICY "marketflow_notifications_admin" ON public.notification_messages
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "marketflow_loyalty_account_owner" ON public.loyalty_accounts;
CREATE POLICY "marketflow_loyalty_account_owner" ON public.loyalty_accounts
FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_loyalty_tx_owner" ON public.loyalty_transactions;
CREATE POLICY "marketflow_loyalty_tx_owner" ON public.loyalty_transactions
FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_loyalty_rewards_read" ON public.loyalty_rewards;
CREATE POLICY "marketflow_loyalty_rewards_read" ON public.loyalty_rewards
FOR SELECT USING (active = TRUE OR public.is_admin());
DROP POLICY IF EXISTS "marketflow_loyalty_rewards_admin" ON public.loyalty_rewards;
CREATE POLICY "marketflow_loyalty_rewards_admin" ON public.loyalty_rewards
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "marketflow_loyalty_redemptions_owner" ON public.loyalty_redemptions;
CREATE POLICY "marketflow_loyalty_redemptions_owner" ON public.loyalty_redemptions
FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());

-- Garante grants básicos para PostgREST. RLS continua sendo a barreira real.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_permissions TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_contact_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_messages TO authenticated;
GRANT SELECT ON public.loyalty_accounts, public.loyalty_transactions, public.loyalty_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT SELECT ON public.delivery_zones, public.banners, public.promotions, public.loyalty_rewards TO anon;
GRANT SELECT, UPDATE ON public.orders, public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT SELECT ON public.addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;

-- --------------------------------------------------------------------------
-- 9) REALTIME sem erro de duplicidade
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'loyalty_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_accounts;
  END IF;
END $$;

COMMIT;

-- Resultado de conferência. Deve retornar as três funções permitidas.
SELECT role, count(*) AS total
FROM public.user_profiles
GROUP BY role
ORDER BY role;
