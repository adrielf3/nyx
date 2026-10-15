import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { ActionButton } from './ActionButton';
import { SectionCard } from './SectionCard';

type OverlayControlCardProps = {
  hasPermission: boolean;
  isActive: boolean;
  isBusy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
};

export function OverlayControlCard({
  hasPermission,
  isActive,
  isBusy,
  onActivate,
  onDeactivate,
}: OverlayControlCardProps) {
  return (
    <SectionCard title="Personagem flutuante">
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, hasPermission && styles.allowed]} />
        <Text style={styles.statusText}>
          Permissão {hasPermission ? 'concedida' : 'pendente'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isActive && styles.allowed]} />
        <Text style={styles.statusText}>
          Sobreposição {isActive ? 'ativa' : 'inativa'}
        </Text>
      </View>
      <ActionButton
        label="Ativar sobreposição"
        onPress={onActivate}
        disabled={isBusy}
      />
      <ActionButton
        label="Desativar sobreposição"
        onPress={onDeactivate}
        disabled={isBusy}
        variant="secondary"
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginRight: 8,
  },
  allowed: {
    backgroundColor: colors.success,
  },
  statusText: {
    color: '#c9bfdc',
    fontSize: 14,
  },
});
