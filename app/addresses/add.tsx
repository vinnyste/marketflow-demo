import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { addressesService } from '@/services/addresses';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const PRESET_LABELS = ['Casa', 'Trabalho', 'Outro'] as const;
type PresetLabel = typeof PRESET_LABELS[number];

async function fetchAddressByCep(cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const json = await res.json();
    if (json.erro) return null;
    return {
      street: json.logradouro || '',
      neighborhood: json.bairro || '',
      city: json.localidade || '',
      state: json.uf || '',
    };
  } catch {
    return null;
  }
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function AddAddressScreen() {
  const { user } = useAuth();

  // Label selection
  const [selectedPreset, setSelectedPreset] = useState<PresetLabel>('Casa');
  const [customLabel, setCustomLabel] = useState('');

  // Address fields
  const [recipientName, setRecipientName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [reference, setReference] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getFinalLabel = (): string => {
    if (selectedPreset !== 'Outro') return selectedPreset;
    return customLabel.trim() || 'Outro';
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setZipCode(formatted);
    setCepError('');
    const digits = value.replace(/\D/g, '');
    if (digits.length === 8) {
      setCepLoading(true);
      const result = await fetchAddressByCep(digits);
      setCepLoading(false);
      if (result) {
        setStreet(result.street);
        setNeighborhood(result.neighborhood);
        setCity(result.city);
        setAddressState(result.state);
      } else {
        setStreet('');
        setNeighborhood('');
        setCity('');
        setAddressState('');
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      }
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (selectedPreset === 'Outro' && !customLabel.trim()) {
      errs.customLabel = 'Informe um nome para este endereço.';
    }
    if (!recipientName.trim()) errs.recipientName = 'Campo obrigatório';
    const zipDigits = zipCode.replace(/\D/g, '');
    if (!zipDigits || zipDigits.length !== 8) errs.zipCode = 'Informe um CEP válido com 8 dígitos';
    if (!street.trim()) errs.street = 'Campo obrigatório';
    if (!number.trim()) errs.number = 'Campo obrigatório';
    if (!neighborhood.trim()) errs.neighborhood = 'Campo obrigatório';
    if (!city.trim()) errs.city = 'Campo obrigatório';
    if (!addressState.trim()) errs.state = 'Campo obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    setLoading(true);
    try {
      await addressesService.create({
        user_id: user.id,
        label: getFinalLabel(),
        recipient_name: recipientName.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: addressState.trim().toUpperCase(),
        zip_code: zipCode,
        is_default: isDefault,
        reference: reference.trim() || null,
      } as any);
      router.back();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar endereço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Label selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo de endereço</Text>
          <View style={styles.labelRow}>
            {PRESET_LABELS.map((l) => (
              <Pressable
                key={l}
                style={[styles.labelChip, selectedPreset === l && styles.labelChipSelected]}
                onPress={() => setSelectedPreset(l)}
              >
                <Text style={[styles.labelChipText, selectedPreset === l && styles.labelChipTextSelected]}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedPreset === 'Outro' ? (
            <Input
              label="Nome do endereço *"
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder='Ex: Casa da mãe, Chácara, Escritório...'
              autoCapitalize="words"
              error={errors.customLabel}
            />
          ) : null}
        </View>

        <Input
          label="Nome do destinatário *"
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Nome completo"
          leftIcon="person"
          error={errors.recipientName}
          autoCapitalize="words"
        />

        {/* CEP */}
        <View>
          <Input
            label="CEP *"
            value={zipCode}
            onChangeText={handleCepChange}
            placeholder="00000-000"
            keyboardType="numeric"
            leftIcon="pin"
            error={errors.zipCode || cepError}
          />
          {cepLoading ? (
            <View style={styles.cepLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.cepLoadingText}>Buscando endereço...</Text>
            </View>
          ) : null}
        </View>

        <Input
          label="Rua/Avenida *"
          value={street}
          onChangeText={setStreet}
          placeholder="Nome da rua"
          leftIcon="place"
          error={errors.street}
          autoCapitalize="words"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              label="Número *"
              value={number}
              onChangeText={setNumber}
              placeholder="Nº"
              error={errors.number}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Input
              label="Complemento"
              value={complement}
              onChangeText={setComplement}
              placeholder="Apto, bloco..."
              autoCapitalize="words"
            />
          </View>
        </View>

        <Input
          label="Bairro *"
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="Bairro"
          error={errors.neighborhood}
          autoCapitalize="words"
        />

        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <Input
              label="Cidade *"
              value={city}
              onChangeText={setCity}
              placeholder="Cidade"
              error={errors.city}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="UF *"
              value={addressState}
              onChangeText={(v) => setAddressState(v.toUpperCase())}
              placeholder="SP"
              maxLength={2}
              error={errors.state}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Input
          label="Ponto de referência"
          value={reference}
          onChangeText={setReference}
          placeholder="Próximo à escola, portão azul..."
          leftIcon="info-outline"
          autoCapitalize="sentences"
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Definir como endereço padrão</Text>
          <Switch
            value={isDefault}
            onValueChange={setIsDefault}
            trackColor={{ true: Colors.primary, false: Colors.border }}
            thumbColor={Colors.surface}
          />
        </View>

        <Button label="Salvar endereço" onPress={handleSave} loading={loading} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  labelRow: { flexDirection: 'row', gap: Spacing.sm },
  labelChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  labelChipSelected: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  labelChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  labelChipTextSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },
  cepLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    paddingHorizontal: 4,
  },
  cepLoadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
});
