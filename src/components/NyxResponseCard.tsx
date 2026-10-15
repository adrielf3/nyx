import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { InteractionState } from '../conversation/types';
import { colors } from '../theme/colors';
import { ActionButton } from './ActionButton';

type NyxResponseCardProps = {
  interactionState: InteractionState;
  onStopSpeaking: () => void;
  response: string;
};

const stateLabels: Record<InteractionState, string> = {
  idle: 'Pronta',
  listening: 'Ouvindo',
  processing: 'Pensando',
  speaking: 'Falando',
  success: 'Concluído',
  error: 'Atenção',
};

export function NyxResponseCard({
  interactionState,
  onStopSpeaking,
  response,
}: NyxResponseCardProps) {
  const isWorking =
    interactionState === 'listening' || interactionState === 'processing';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Resposta do Nyx</Text>
        <Text style={styles.state}>{stateLabels[interactionState]}</Text>
      </View>
      <Text style={styles.response}>{response}</Text>
      {isWorking && (
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      )}
      {interactionState === 'speaking' && (
        <ActionButton
          label="Interromper fala"
          onPress={onStopSpeaking}
          variant="secondary"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  label: {
    color: colors.label,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  state: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  response: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 7,
  },
  loader: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
});
