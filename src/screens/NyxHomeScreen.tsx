import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConversationHistoryCard } from '../components/ConversationHistoryCard';
import { NyxHeader } from '../components/NyxHeader';
import { MediaControlCard } from '../components/MediaControlCard';
import { NyxResponseCard } from '../components/NyxResponseCard';
import { OverlayControlCard } from '../components/OverlayControlCard';
import { VoiceCommandCard } from '../components/VoiceCommandCard';
import { useNyxController } from '../hooks/useNyxController';
import { colors } from '../theme/colors';

export function NyxHomeScreen() {
  const {
    activateOverlay,
    clearHistory,
    deactivateOverlay,
    hasOverlayPermission,
    hasMediaControlPermission,
    history,
    interactionState,
    isBusy,
    isOverlayActive,
    listen,
    openMediaControlSettings,
    recognizedText,
    response,
    stopSpeaking,
  } = useNyxController();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <NyxHeader />
        <OverlayControlCard
          hasPermission={hasOverlayPermission}
          isActive={isOverlayActive}
          isBusy={isBusy}
          onActivate={activateOverlay}
          onDeactivate={deactivateOverlay}
        />
        <MediaControlCard
          hasPermission={hasMediaControlPermission}
          isBusy={isBusy}
          onOpenSettings={openMediaControlSettings}
        />
        <VoiceCommandCard
          isBusy={isBusy}
          recognizedText={recognizedText}
          onListen={listen}
        />
        <NyxResponseCard
          interactionState={interactionState}
          onStopSpeaking={stopSpeaking}
          response={response}
        />
        <ConversationHistoryCard messages={history} onClear={clearHistory} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 22,
    gap: 16,
  },
});
