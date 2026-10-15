import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { ActionButton } from './ActionButton';
import { SectionCard } from './SectionCard';

type VoiceCommandCardProps = {
  isBusy: boolean;
  recognizedText: string;
  onListen: () => void;
};

export function VoiceCommandCard({
  isBusy,
  recognizedText,
  onListen,
}: VoiceCommandCardProps) {
  return (
    <SectionCard title="Comando por voz">
      <Text style={styles.hint}>Experimente: “Nyx, abre o YouTube.”</Text>
      <ActionButton
        label="Falar com Nyx"
        onPress={onListen}
        disabled={isBusy}
      />
      <Text style={styles.label}>Comando reconhecido</Text>
      <Text style={styles.value}>
        {recognizedText || 'Nenhum comando ainda.'}
      </Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.label,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 18,
  },
  value: {
    color: colors.textSoft,
    fontSize: 16,
    marginTop: 6,
    lineHeight: 23,
  },
});
