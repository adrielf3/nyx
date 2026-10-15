import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { ActionButton } from './ActionButton';
import { SectionCard } from './SectionCard';

type MediaControlCardProps = {
  hasPermission: boolean;
  isBusy: boolean;
  onOpenSettings: () => void;
};

export function MediaControlCard({
  hasPermission,
  isBusy,
  onOpenSettings,
}: MediaControlCardProps) {
  return (
    <SectionCard title="Controle do YouTube Music">
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, hasPermission && styles.allowed]} />
        <Text style={styles.statusText}>
          Controle de mídia {hasPermission ? 'autorizado' : 'pendente'}
        </Text>
      </View>
      <Text style={styles.description}>
        O Android exige acesso às notificações para a Nyx localizar a sessão de
        mídia do YouTube Music. A Nyx não lê, armazena ou envia o conteúdo das
        suas notificações.
      </Text>
      {!hasPermission && (
        <ActionButton
          label="Abrir configurações de acesso"
          onPress={onOpenSettings}
          disabled={isBusy}
          variant="secondary"
        />
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
    color: colors.textSoft,
    fontSize: 14,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
