import { supabase } from '@/lib/supabase';
import { Category, Product, ProductUnit } from '@/types/database';

const PREPARED_CATALOG_URL = '/catalogo/produtos.csv';
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 100;
const ALLOWED_UNITS = new Set<ProductUnit>(['un', 'kg', 'L', 'g', 'ml']);

type CatalogRow = {
  name: string;
  price: number;
  unit: ProductUnit;
  soldByWeight: boolean;
  categoryName: string;
  groupName: string | null;
  barcode: string | null;
  imageUrl: string | null;
};

export type CatalogImportProgress = {
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  withExactImage: number;
};

export type CatalogImportResult = Omit<CatalogImportProgress, 'processed' | 'total'> & {
  total: number;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function slugify(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseDelimited(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim()));
}

function safeRemoteImageUrl(value: string): string | null {
  const clean = value.trim();
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:') return null;
    const trustedHosts = [
      'images.openfoodfacts.org',
      'images.openbeautyfacts.org',
      'images.openproductsfacts.org',
    ];
    return trustedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function parseCatalog(text: string): CatalogRow[] {
  const [headers = [], ...values] = parseDelimited(text);
  const positions = new Map(
    headers.map((header, index) => [normalize(header), index])
  );
  const column = (row: string[], name: string) =>
    row[positions.get(normalize(name)) ?? -1]?.trim() || '';

  return values.map((row, index) => {
    const name = column(row, 'nome');
    const price = Number(column(row, 'preco').replace(',', '.'));
    const requestedUnit = column(row, 'unidade') as ProductUnit;
    const unit = ALLOWED_UNITS.has(requestedUnit) ? requestedUnit : 'un';
    const categoryName = column(row, 'categoria');
    if (!name || !Number.isFinite(price) || price <= 0 || !categoryName) {
      throw new Error(`Linha ${index + 2} do catálogo está incompleta.`);
    }
    return {
      name,
      price,
      unit,
      soldByWeight: normalize(column(row, 'pesavel')) === 'sim',
      categoryName,
      groupName: column(row, 'grupo') || null,
      barcode: column(row, 'codigo de barras') || null,
      imageUrl: safeRemoteImageUrl(column(row, 'url da imagem')),
    };
  });
}

async function loadAllProducts(): Promise<Product[]> {
  const products: Product[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    products.push(...((data || []) as Product[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return products;
}

async function ensureCategories(
  rows: CatalogRow[],
  currentCategories: Category[]
): Promise<Map<string, Category>> {
  const byName = new Map(
    currentCategories.map((category) => [normalize(category.name), category])
  );
  const names = [...new Set(rows.map((row) => row.categoryName))];

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (byName.has(normalize(name))) continue;
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug: slugify(name),
        active: true,
        sort_order: index + currentCategories.length,
      })
      .select()
      .single();
    if (error) throw error;
    byName.set(normalize(name), data as Category);
  }
  return byName;
}

async function writeBatches(
  rows: Record<string, unknown>[],
  mode: 'insert' | 'update',
  onBatch: (count: number) => void
) {
  for (let start = 0; start < rows.length; start += WRITE_BATCH_SIZE) {
    const batch = rows.slice(start, start + WRITE_BATCH_SIZE);
    const query =
      mode === 'insert'
        ? supabase.from('products').insert(batch)
        : supabase.from('products').upsert(batch, { onConflict: 'id' });
    const { error } = await query;
    if (error) throw error;
    onBatch(batch.length);
  }
}

export const productCatalogImportService = {
  async importPreparedCatalog(
    categories: Category[],
    onProgress?: (progress: CatalogImportProgress) => void
  ): Promise<CatalogImportResult> {
    const response = await fetch(PREPARED_CATALOG_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('O catálogo preparado não foi encontrado nesta versão do painel.');
    }
    const rows = parseCatalog(await response.text());
    const [existingProducts, categoriesByName] = await Promise.all([
      loadAllProducts(),
      ensureCategories(rows, categories),
    ]);

    const existingByBarcode = new Map(
      existingProducts
        .filter((product) => product.barcode)
        .map((product) => [String(product.barcode), product])
    );
    const existingByName = new Map(
      existingProducts.map((product) => [normalize(product.name), product])
    );
    const inserts: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    let withExactImage = 0;

    for (const row of rows) {
      const existing =
        (row.barcode ? existingByBarcode.get(row.barcode) : undefined) ||
        existingByName.get(normalize(row.name));
      const category = categoriesByName.get(normalize(row.categoryName));
      const payload = {
        ...(existing ? { id: existing.id } : {}),
        name: row.name,
        price: row.price,
        unit: row.unit,
        sold_by_weight: row.soldByWeight,
        category_id: category?.id || null,
        group_name: row.groupName,
        barcode: row.barcode,
        image_url: row.imageUrl || existing?.image_url || null,
        active: true,
        stock_quantity: existing?.stock_quantity || 0,
        updated_at: new Date().toISOString(),
      };
      if (row.imageUrl) withExactImage += 1;
      if (existing) updates.push(payload);
      else inserts.push(payload);
    }

    let inserted = 0;
    let updated = 0;
    const notify = () =>
      onProgress?.({
        processed: inserted + updated,
        total: rows.length,
        inserted,
        updated,
        withExactImage,
      });
    notify();
    await writeBatches(updates, 'update', (count) => {
      updated += count;
      notify();
    });
    await writeBatches(inserts, 'insert', (count) => {
      inserted += count;
      notify();
    });

    return { total: rows.length, inserted, updated, withExactImage };
  },
};
