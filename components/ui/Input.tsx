import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff, AlertCircle, Mail, Lock, Phone, User, Cake, Search, LucideIcon } from 'lucide-react-native';
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme';

// Map legacy icon name strings to lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  email: Mail,
  lock: Lock,
  'lock-outline': Lock,
  phone: Phone,
  person: User,
  cake: Cake,
  search: Search,
};

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  secureTextEntry,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  const LeftIconComponent = leftIcon ? ICON_MAP[leftIcon] : null;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        {LeftIconComponent ? (
          <LeftIconComponent size={20} color={Colors.textMuted} style={styles.leftIcon} />
        ) : null}
        <TextInput
          style={[styles.input, LeftIconComponent ? styles.inputWithLeft : null]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          selectionColor={Colors.primary}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
            hitSlop={8}
          >
            {showPassword ? (
              <EyeOff size={20} color={Colors.textMuted} />
            ) : (
              <Eye size={20} color={Colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  inputError: { borderColor: Colors.error },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  inputWithLeft: { paddingLeft: 0 },
  leftIcon: { marginLeft: Spacing.md },
  rightIcon: { paddingRight: Spacing.md },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
  },
});
