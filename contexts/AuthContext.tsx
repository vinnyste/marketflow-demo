import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { authService } from '@/services/auth';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True after session restoration and profile loading have finished. */
  authInitialized: boolean;
  /** @deprecated use authInitialized — kept for backward compatibility. */
  isLoading: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  refreshAuth: () => Promise<Profile | null>;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Every auth synchronization gets a sequence number. Slow/stale requests are
  // ignored, preventing an old profile response from overwriting a newer login.
  const syncSequence = useRef(0);
  const mounted = useRef(true);
  const currentUserId = useRef<string | null>(null);

  const applySession = useCallback(async (nextSession: Session | null): Promise<Profile | null> => {
    const sequence = ++syncSequence.current;
    const nextUser = nextSession?.user ?? null;

    let nextProfile: Profile | null = null;
    if (nextUser) {
      nextProfile = await authService.getProfile(nextUser.id);
    }

    if (!mounted.current || sequence !== syncSequence.current) {
      return nextProfile;
    }

    currentUserId.current = nextUser?.id ?? null;
    setSession(nextSession);
    setUser(nextUser);
    setProfile(nextProfile);
    setAuthInitialized(true);
    return nextProfile;
  }, []);

  const refreshAuth = useCallback(async (): Promise<Profile | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return applySession(data.session);
  }, [applySession]);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    const userId = currentUserId.current;
    if (!userId) {
      setProfile(null);
      return null;
    }

    const nextProfile = await authService.getProfile(userId);
    // Do not apply a profile fetched for a session that changed mid-request.
    if (mounted.current && currentUserId.current === userId) {
      setProfile(nextProfile);
    }
    return nextProfile;
  }, []);

  useEffect(() => {
    mounted.current = true;

    void refreshAuth().catch((error) => {
      console.error('Falha ao restaurar sessão:', error);
      if (!mounted.current) return;
      currentUserId.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthInitialized(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep the auth callback itself synchronous. Supabase may hold an internal
      // lock while this callback runs, so profile fetching is deferred.
      setTimeout(() => {
        void applySession(nextSession).catch((error) => {
          console.error('Falha ao sincronizar autenticação:', error);
          if (!mounted.current) return;
          currentUserId.current = nextSession?.user?.id ?? null;
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setProfile(null);
          setAuthInitialized(true);
        });
      }, 0);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession, refreshAuth]);

  const signOut = useCallback(async () => {
    // Invalidate any pending profile request before clearing the session.
    syncSequence.current += 1;
    await authService.signOut();
    if (!mounted.current) return;
    currentUserId.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthInitialized(true);
  }, []);

  const isAdmin = profile?.role === 'admin' && profile?.active !== false;
  const isOperator =
    (profile?.role === 'operator' || profile?.role === 'admin') &&
    profile?.active !== false;

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    profile,
    authInitialized,
    isLoading: !authInitialized,
    isAdmin,
    isOperator,
    refreshAuth,
    refreshProfile,
    signOut,
  }), [
    session,
    user,
    profile,
    authInitialized,
    isAdmin,
    isOperator,
    refreshAuth,
    refreshProfile,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
