import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConversationMessage } from '../conversation/types';
import { colors } from '../theme/colors';
import { SectionCard } from './SectionCard';

type ConversationHistoryCardProps = {
  messages: readonly ConversationMessage[];
  onClear: () => void;
};

export function ConversationHistoryCard({
  messages,
  onClear,
}: ConversationHistoryCardProps) {
  const visibleMessages = messages.filter(message => message.role !== 'tool');

  return (
    <SectionCard title="Conversa recente">
      {visibleMessages.length === 0 ? (
        <Text style={styles.empty}>A conversa aparecerá aqui.</Text>
      ) : (
        <View style={styles.messages}>
          {visibleMessages.map(message => (
            <View key={message.id} style={styles.message}>
              <Text style={styles.role}>
                {message.role === 'user' ? 'Você' : 'Nyx'}
              </Text>
              <Text style={styles.content}>{message.content}</Text>
            </View>
          ))}
        </View>
      )}
      {visibleMessages.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Text style={styles.clearLabel}>Limpar histórico</Text>
        </Pressable>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.textMuted,
    lineHeight: 21,
  },
  messages: {
    gap: 12,
  },
  message: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 10,
  },
  role: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  content: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  clear: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 6,
  },
  clearLabel: {
    color: colors.primaryLight,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
