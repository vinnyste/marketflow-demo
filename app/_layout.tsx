import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';

/**
 * The same Expo project also contains the customer mobile app. On the web,
 * however, only internal administration and operation routes are exposed.
 * Any attempt to open a customer route is sent to the single internal login.
 */
function WebInternalOnlyGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const isInternalRoute =
    pathname === '/' ||
    pathname === '/admin-login' ||
    pathname.startsWith('/admin/') ||
    pathname === '/admin' ||
    pathname.startsWith('/operator/') ||
    pathname === '/operator';

  if (!isInternalRoute) {
    return <Redirect href="/admin-login" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <WebInternalOnlyGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/register" options={{ headerShown: false }} />
              <Stack.Screen name="auth/verify-email" options={{ headerShown: false }} />
              <Stack.Screen name="products/[id]" options={{ headerShown: true, title: 'Produto', headerTintColor: '#C9A84C', headerStyle: { backgroundColor: '#1A1A1A' }, headerTitleStyle: { color: '#F5F0E8' } }} />
              <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Finalizar Pedido', headerTintColor: '#C9A84C', headerStyle: { backgroundColor: '#1A1A1A' }, headerTitleStyle: { color: '#F5F0E8' } }} />
              <Stack.Screen name="orders/[id]" options={{ headerShown: true, title: 'Meu Pedido', headerTintColor: '#C9A84C', headerStyle: { backgroundColor: '#1A1A1A' }, headerTitleStyle: { color: '#F5F0E8' } }} />
              <Stack.Screen name="addresses/index" options={{ headerShown: true, title: 'Meus Endereços', headerTintColor: '#C9A84C', headerStyle: { backgroundColor: '#1A1A1A' }, headerTitleStyle: { color: '#F5F0E8' } }} />
              <Stack.Screen name="addresses/add" options={{ headerShown: true, title: 'Novo Endereço', headerTintColor: '#C9A84C', headerStyle: { backgroundColor: '#1A1A1A' }, headerTitleStyle: { color: '#F5F0E8' } }} />
              <Stack.Screen name="admin-login" options={{ headerShown: false }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
              <Stack.Screen name="about" options={{ headerShown: false }} />
              <Stack.Screen name="contact" options={{ headerShown: false }} />
              <Stack.Screen name="help" options={{ headerShown: false }} />
              <Stack.Screen name="privacy" options={{ headerShown: false }} />
              <Stack.Screen name="terms" options={{ headerShown: false }} />
              <Stack.Screen name="operator-login" options={{ headerShown: false }} />
              <Stack.Screen name="operator" options={{ headerShown: false }} />
            </Stack>
          </WebInternalOnlyGuard>
          <StatusBar style="auto" />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
