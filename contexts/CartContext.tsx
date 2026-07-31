import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { CartItem } from '@/types/database';
import { cartService } from '@/services/cart';
import { AuthContext } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  totalItems: number;
  totalPrice: number;
  addItem: (productId: string, quantity: number) => Promise<{ error?: string }>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;
  const userId = user?.id ?? null;

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await cartService.getItems(userId);
      setItems(data);
    } catch (e) {
      console.error('Cart refresh error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = async (productId: string, quantity: number): Promise<{ error?: string }> => {
    if (!user) return { error: 'not_authenticated' };
    try {
      await cartService.addItem(user.id, productId, quantity);
      await refresh();
      return {};
    } catch (e: any) {
      console.error('Erro ao adicionar ao carrinho:', {
        code: e?.code,
        status: e?.status,
        message: e?.message,
        details: e?.details,
      });
      return { error: e?.message || 'Erro ao adicionar ao carrinho' };
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    // Evita valores como 1.7000000000000002 ao somar pesos de 100 g.
    const normalizedQuantity = Math.round(Number(quantity) * 1000) / 1000;
    await cartService.updateQuantity(itemId, normalizedQuantity);
    await refresh();
  };

  const removeItem = async (itemId: string) => {
    await cartService.removeItem(itemId);
    await refresh();
  };

  const clearCart = async () => {
    // A interface precisa esvaziar imediatamente após o pedido ser criado.
    // A limpeza remota é tolerante a falhas porque createFromCart já remove
    // os itens no banco; assim uma oscilação de rede não gera pedido duplicado.
    setItems([]);
    if (!user) return;
    try {
      await cartService.clearCart(user.id);
    } catch (error) {
      console.warn('Não foi possível repetir a limpeza remota do carrinho:', error);
    }
  };

  const totalItems = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    // Produto por peso conta como um item no carrinho, e não como 0,6 ou 1,1 item.
    if (item.product?.sold_by_weight) return sum + 1;
    return sum + Math.max(0, Math.round(quantity));
  }, 0);
  const totalPrice = items.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{ items, isLoading, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}
