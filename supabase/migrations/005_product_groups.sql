-- Preserva o grupo original do sistema dentro de cada categoria do app.
-- O campo é opcional: produtos sem classificação segura permanecem sem grupo.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_name TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category_group_name
  ON public.products(category_id, group_name);

COMMENT ON COLUMN public.products.group_name IS
  'Grupo original do produto dentro da categoria; nulo quando não houver classificação segura.';
