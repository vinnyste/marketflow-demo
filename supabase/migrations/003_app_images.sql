-- MarketFlow Demo — armazenamento seguro de imagens do app
-- Execute uma única vez no Supabase SQL Editor antes de usar o botão
-- "Escolher imagem do computador" no painel administrativo.

BEGIN;

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
