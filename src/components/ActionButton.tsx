import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={isPrimary ? styles.primaryLabel : styles.secondaryLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  secondary: {
    minHeight: 44,
  },
  primaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.primaryLight,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
