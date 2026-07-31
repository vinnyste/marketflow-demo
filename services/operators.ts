import { supabase } from '@/lib/supabase';
import { Profile, OperatorPermissions, OperatorContactLog } from '@/types/database';

export const operatorsService = {
  // ─── List operators ─────────────────────────────────────────────────────────
  // Uses two separate queries to avoid PostgREST join errors when
  // operator_permissions row doesn't exist yet for a newly promoted operator.
  async getAll(): Promise<(Profile & { permissions?: OperatorPermissions })[]> {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role, active, phone, avatar_url, created_at, updated_at')
      .eq('role', 'operator')
      .order('full_name');

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) return [];

    const ids = profiles.map((p: any) => p.id);
    const { data: perms, error: permissionsError } = await supabase
      .from('operator_permissions')
      .select('*')
      .in('operator_id', ids);
    if (permissionsError) throw permissionsError;

    const permMap: Record<string, OperatorPermissions> = {};
    if (perms) {
      for (const p of perms as OperatorPermissions[]) {
        permMap[p.operator_id] = p;
      }
    }

    return profiles.map((p: any) => ({
      ...p,
      permissions: permMap[p.id] ?? undefined,
    })) as (Profile & { permissions?: OperatorPermissions })[];
  },

  // ─── Search user by email (exact match) ─────────────────────────────────────
  async searchByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .ilike('email', email.trim())
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },

  // ─── Promote to operator via secure RPC ─────────────────────────────────────
  // Returns error message string on failure, null on success
  async promoteToOperatorByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('admin_set_user_role_by_email', {
      p_email: email.trim(),
      p_role: 'operator',
    });
    if (error) return error.message;
    if (data?.error) return data.error as string;
    return null;
  },

  // ─── Demote operator to customer via secure RPC ───────────────────────────
  async demoteOperatorByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('admin_set_user_role_by_email', {
      p_email: email.trim(),
      p_role: 'customer',
    });
    if (error) return error.message;
    if (data?.error) return data.error as string;
    return null;
  },

  // ─── Compatibility helpers: resolve the e-mail and still use the secure RPC ──
  async promoteToOperator(userId: string, _grantedBy: string): Promise<void> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();
    if (error) throw error;
    if (!data?.email) throw new Error('Usuário sem e-mail cadastrado.');

    const { data: result, error: rpcError } = await supabase.rpc('admin_set_user_role_by_email', {
      p_email: data.email,
      p_role: 'operator',
    });
    if (rpcError) throw rpcError;
    if (result?.error) throw new Error(result.error as string);
  },

  async demoteOperator(userId: string, _adminId: string): Promise<void> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();
    if (error) throw error;
    if (!data?.email) throw new Error('Usuário sem e-mail cadastrado.');

    const { data: result, error: rpcError } = await supabase.rpc('admin_set_user_role_by_email', {
      p_email: data.email,
      p_role: 'customer',
    });
    if (rpcError) throw rpcError;
    if (result?.error) throw new Error(result.error as string);
  },

  // ─── Toggle active ──────────────────────────────────────────────────────────
  async setActive(userId: string, active: boolean, adminId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    await supabase.from('audit_log').insert({
      user_id: adminId,
      role: 'admin',
      action: active ? 'activate_operator' : 'deactivate_operator',
      entity_type: 'user_profiles',
      entity_id: userId,
    });
  },

  // ─── Update permissions ─────────────────────────────────────────────────────
  async updatePermissions(
    operatorId: string,
    permissions: Partial<Omit<OperatorPermissions, 'id' | 'operator_id' | 'created_at'>>,
    adminId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('operator_permissions')
      .upsert(
        {
          operator_id: operatorId,
          granted_by: adminId,
          ...permissions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'operator_id' }
      );
    if (error) throw error;

    await supabase.from('audit_log').insert({
      user_id: adminId,
      role: 'admin',
      action: 'update_operator_permissions',
      entity_type: 'operator_permissions',
      new_value: permissions as any,
    });
  },

  // ─── Get permissions for current operator ──────────────────────────────────
  async getMyPermissions(operatorId: string): Promise<OperatorPermissions | null> {
    const { data, error } = await supabase
      .from('operator_permissions')
      .select('*')
      .eq('operator_id', operatorId)
      .single();
    if (error) return null;
    return data as OperatorPermissions;
  },

  // ─── Contact log ────────────────────────────────────────────────────────────
  async logContact(
    orderId: string,
    operatorId: string,
    reason: string,
    note?: string
  ): Promise<void> {
    const { error } = await supabase.from('operator_contact_log').insert({
      order_id: orderId,
      operator_id: operatorId,
      reason,
      note: note || null,
    });
    if (error) throw error;
  },

  async getContactLog(orderId: string): Promise<OperatorContactLog[]> {
    const { data, error } = await supabase
      .from('operator_contact_log')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data as OperatorContactLog[];
  },

  // ─── Audit log for operator actions ────────────────────────────────────────
  async logAction(
    userId: string,
    role: string,
    action: string,
    orderId?: string,
    entityType?: string,
    entityId?: string,
    reason?: string,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>
  ): Promise<void> {
    await supabase.from('audit_log').insert({
      user_id: userId,
      role,
      action,
      order_id: orderId || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
      reason: reason || null,
      old_value: oldValue || null,
      new_value: newValue || null,
    });
  },
};
