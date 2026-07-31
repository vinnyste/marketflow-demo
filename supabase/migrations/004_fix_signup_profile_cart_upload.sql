-- MarketFlow Demo — correções consolidadas de cadastro, perfil e imagens
-- Execute uma única vez no Supabase SQL Editor.

BEGIN;

-- --------------------------------------------------------------------------
-- 1) CADASTRO E PERFIL DO CLIENTE
-- --------------------------------------------------------------------------

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

-- Recupera automaticamente o perfil de contas antigas que tenham usuário no
-- Auth, mas ainda não possuam linha em user_profiles.
CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS SETOF public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

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
    NOW(),
    NOW()
  FROM auth.users u
  WHERE u.id = v_uid
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.user_profiles.email),
    full_name = COALESCE(NULLIF(public.user_profiles.full_name, ''), EXCLUDED.full_name),
    phone = COALESCE(public.user_profiles.phone, EXCLUDED.phone),
    birth_date = COALESCE(public.user_profiles.birth_date, EXCLUDED.birth_date),
    updated_at = NOW();

  RETURN QUERY
  SELECT * FROM public.user_profiles WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketflow_profiles_select" ON public.user_profiles;
CREATE POLICY "marketflow_profiles_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_operator());

DROP POLICY IF EXISTS "marketflow_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "marketflow_profiles_insert_own"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "marketflow_profiles_update_own_or_admin" ON public.user_profiles;
CREATE POLICY "marketflow_profiles_update_own_or_admin"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT INSERT (id, email, full_name, phone, avatar_url, birth_date, active, created_at, updated_at)
  ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name, phone, avatar_url, birth_date, updated_at)
  ON public.user_profiles TO authenticated;

-- --------------------------------------------------------------------------
-- 2) ARMAZENAMENTO DE IMAGENS DO ADMIN
-- --------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'app-images',
  'app-images',
  TRUE,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view app images" ON storage.objects;
CREATE POLICY "Public can view app images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

DROP POLICY IF EXISTS "Admins can upload app images" ON storage.objects;
CREATE POLICY "Admins can upload app images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update app images" ON storage.objects;
CREATE POLICY "Admins can update app images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-images' AND public.is_admin())
WITH CHECK (bucket_id = 'app-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete app images" ON storage.objects;
CREATE POLICY "Admins can delete app images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-images' AND public.is_admin());

COMMIT;
