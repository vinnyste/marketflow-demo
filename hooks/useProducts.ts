import { useState, useEffect, useCallback } from 'react';
import { Product, Category } from '@/types/database';
import { productsService } from '@/services/products';
import { categoriesService } from '@/services/categories';

export function useProducts(filters?: {
  categoryId?: string;
  featured?: boolean;
  search?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categoryId = filters?.categoryId;
  const featured = filters?.featured;
  const search = filters?.search;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await productsService.getAll({ categoryId, featured, search });
      setProducts(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, featured, search]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, isLoading, error, refresh: load };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    categoriesService.getAll().then((data) => {
      setCategories(data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  return { categories, isLoading };
}
