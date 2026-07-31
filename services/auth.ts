import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  birthDate?: string; // ISO date YYYY-MM-DD
}

export interface SignInData {
  email: string;
  password: string;
}

type EditableProfileFields = Pick<Profile, 'full_name' | 'phone' | 'avatar_url' | 'birth_date'>;

async function ensureProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('ensure_own_profile');
  if (error) {
    console.error('Não foi possível garantir o perfil do usuário:', error);
    return null;
  }

  if (Array.isArray(data)) return (data[0] as Profile | undefined) ?? null;
  return (data as Profile | null) ?? null;
}

export const authService = {
  async signUp({ email, password, fullName, phone, birthDate }: SignUpData) {
    // Todos os dados necessários são enviados como metadata. O trigger do
    // Supabase cria user_profiles mesmo quando a confirmação de e-mail está
    // ativa e ainda não existe uma sessão autenticada no celular.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          birth_date: birthDate || null,
          role: 'customer',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn({ email, password }: SignInData) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, phone, avatar_url, role, active, birth_date, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil:', error);
      return null;
    }
    if (data) return data as Profile;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) return null;
    return ensureProfile(user);
  },

  async updateProfile(userId: string, updates: Partial<EditableProfileFields>) {
    // O cliente só pode editar os dados pessoais abaixo. Função, status,
    // e-mail e identificadores nunca são aceitos por este método.
    const safeUpdates: Partial<EditableProfileFields> = {
      full_name: updates.full_name?.trim() || null,
      phone: updates.phone?.replace(/\D/g, '') || null,
      avatar_url: updates.avatar_url || null,
      birth_date: updates.birth_date || null,
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, email, full_name, phone, avatar_url, role, active, birth_date, created_at, updated_at')
      .single();
    if (error) throw error;

    // Mantém os metadados do Supabase Auth alinhados ao perfil. Uma eventual
    // falha aqui não desfaz a atualização principal da tabela.
    void supabase.auth.updateUser({
      data: {
        full_name: safeUpdates.full_name,
        phone: safeUpdates.phone,
        birth_date: safeUpdates.birth_date,
      },
    }).then(({ error: metadataError }) => {
      if (metadataError) console.warn('Não foi possível atualizar os metadados do usuário:', metadataError);
    });

    return data as Profile;
  },
};
