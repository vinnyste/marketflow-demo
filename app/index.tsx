import React from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function IndexScreen() {
  const { session, authInitialized, profile } = useAuth();

  if (!authInitialized) {
    return <LoadingSpinner fullScreen message="Carregando..." />;
  }

  if (Platform.OS === 'web') {
    if (session && profile?.role === 'admin' && profile.active !== false) {
      return <Redirect href="/admin" />;
    }
    if (session && profile?.role === 'operator' && profile.active !== false) {
      return <Redirect href="/operator" />;
    }
    return <Redirect href="/admin-login" />;
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (profile?.role === 'admin' && profile.active !== false) return <Redirect href="/admin" />;
  if (profile?.role === 'operator' && profile.active !== false) return <Redirect href="/operator" />;
  return <Redirect href="/(tabs)" />;
}
