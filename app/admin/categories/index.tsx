import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Plus, Edit2, X, ImageIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { categoriesService } from '@/services/categories';
import { Category } from '@/types/database';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const EMPTY_FORM = { name: '', slug: '', description: '', image_url: '', active: true, sort_order: '0' };

export default function AdminCategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await categoriesService.getAll(false);
    setCategories(data);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, slug: c.slug, description: c.description || '', image_url: c.image_url || '', active: c.active, sort_order: String(c.sort_order) });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name) { alert('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || generateSlug(form.name),
        description: form.description || null,
        image_url: form.image_url || null,
        active: form.active,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (editingId) {
        await categoriesService.update(editingId, payload);
      } else {
        await categoriesService.create(payload);
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando categorias..." />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.count}>{categories.length} categorias</Text>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Plus size={22} color="#fff" />
          <Text style={styles.addBtnText}>Nova categoria</Text>
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <View style={styles.catCard}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.catImage} contentFit="cover" />
            ) : (
              <View style={[styles.catImage, styles.catImagePlaceholder]}>
                <ImageIcon size={22} color={Colors.adminTextMuted} />
              </View>
            )}
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{item.name}</Text>
              <Text style={styles.catSlug}>{item.slug} · Ordem: {item.sort_order}</Text>
              <Text style={[styles.catStatus, item.active ? styles.catActive : styles.catInactive]}>
                {item.active ? 'Ativa' : 'Inativa'}
              </Text>
            </View>
            <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.editBtn}>
              <Edit2 size={20} color={Colors.primary} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar categoria' : 'Nova categoria'}</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input
              label="Nome *"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v, slug: generateSlug(v) })}
              placeholder="Ex: Hortifruti"
              autoCapitalize="words"
            />
            <Input label="Slug" value={form.slug} onChangeText={(v) => setForm({ ...form, slug: v })} placeholder="hortifruti" autoCapitalize="none" />
            <Input label="Descrição" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Descrição opcional" />
            <ImageUploadField
              kind="category"
              value={form.image_url}
              onChange={(image_url) => setForm((current) => ({ ...current, image_url }))}
              label="Imagem da categoria"
            />
            <Input label="Ordem de exibição" value={form.sort_order} onChangeText={(v) => setForm({ ...form, sort_order: v })} keyboardType="numeric" placeholder="0" />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Categoria ativa</Text>
              <Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} trackColor={{ true: Colors.primary }} thumbColor={Colors.surface} />
            </View>
            <Button label={editingId ? 'Salvar alterações' : 'Criar categoria'} onPress={handleSave} loading={saving} fullWidth size="lg" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBackground },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  count: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  catImage: { width: 54, height: 54, borderRadius: Radius.md, backgroundColor: Colors.adminBackground },
  catImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  catInfo: { flex: 1, gap: 2 },
  catName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  catSlug: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  catStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  catActive: { color: Colors.success },
  catInactive: { color: Colors.error },
  editBtn: { padding: 6 },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.borderLight, borderRadius: Radius.md, padding: Spacing.md },
  toggleLabel: { fontSize: FontSize.md, color: Colors.textPrimary },
});
