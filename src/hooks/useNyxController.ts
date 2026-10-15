import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createConversationManager } from '../conversation/ConversationManager';
import type {
  ConversationMessage,
  InteractionState,
} from '../conversation/types';
import { NyxNative } from '../native/NyxNative';
import { requestMicrophonePermission } from '../permissions/microphonePermission';
import { nativeSpeechSynthesizer } from '../speech/speechSynthesizer';
import { errorMessage } from '../utils/errorMessage';

const INITIAL_RESPONSE = 'Pronto para ajudar.';

export function useNyxController() {
  const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
  const [hasMediaControlPermission, setHasMediaControlPermission] =
    useState(false);
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [response, setResponse] = useState(INITIAL_RESPONSE);
  const [isBusy, setIsBusy] = useState(false);
  const [interactionState, setInteractionState] =
    useState<InteractionState>('idle');
  const [history, setHistory] = useState<readonly ConversationMessage[]>([]);
  const shouldActivateOverlay = useRef(false);
  const [conversationManager] = useState(() =>
    createConversationManager(nativeSpeechSynthesizer),
  );

  const processTranscript = useCallback(
    async (transcript: string, source: 'main' | 'overlay') => {
      setRecognizedText(transcript);
      const result = await conversationManager.handleTranscript(transcript, {
        onResponse: setResponse,
        onStateChange: async (state, message) => {
          setInteractionState(state);
          if (source === 'overlay') {
            try {
              await NyxNative.updateOverlayState(state, message);
            } catch {
              // Text and speech remain functional if the overlay is closed.
            }
          }
        },
      });
      setHistory(conversationManager.getHistory());
      return result;
    },
    [conversationManager],
  );

  const refreshOverlayState = useCallback(async () => {
    try {
      const [permissionGranted, overlayRunning, mediaControlGranted] =
        await Promise.all([
          NyxNative.hasOverlayPermission(),
          NyxNative.isOverlayRunning(),
          NyxNative.hasMediaControlPermission(),
        ]);
      setHasOverlayPermission(permissionGranted);
      setIsOverlayActive(overlayRunning);
      setHasMediaControlPermission(mediaControlGranted);

      if (shouldActivateOverlay.current) {
        shouldActivateOverlay.current = false;
        if (permissionGranted) {
          const result = await NyxNative.startOverlay();
          setIsOverlayActive(result.success);
          setResponse(result.message);
        } else {
          setResponse('A permissão de sobreposição não foi concedida.');
        }
      }
    } catch (error) {
      setResponse(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    refreshOverlayState();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshOverlayState();
      }
    });

    return () => subscription.remove();
  }, [refreshOverlayState]);

  useEffect(() => {
    try {
      const commandSubscription = NyxNative.addOverlayCommandListener(
        transcript => {
          processTranscript(transcript, 'overlay').catch(error => {
            setInteractionState('error');
            setResponse(errorMessage(error));
          });
        },
      );
      const stopSubscription = NyxNative.addOverlayStopSpeakingListener(() => {
        nativeSpeechSynthesizer.stop().catch(error => {
          setResponse(errorMessage(error));
        });
      });
      return () => {
        commandSubscription.remove();
        stopSubscription.remove();
      };
    } catch (error) {
      setResponse(errorMessage(error));
      return undefined;
    }
  }, [processTranscript]);

  const activateOverlay = async () => {
    await runSafely(async () => {
      const permissionGranted = await NyxNative.hasOverlayPermission();
      setHasOverlayPermission(permissionGranted);

      if (!permissionGranted) {
        shouldActivateOverlay.current = true;
        await NyxNative.openOverlaySettings();
        setResponse(
          'Conceda a permissão e volte ao Nyx para ativar o personagem.',
        );
        return;
      }

      const result = await NyxNative.startOverlay();
      setIsOverlayActive(result.success);
      setResponse(result.message);
    });
  };

  const deactivateOverlay = async () => {
    await runSafely(async () => {
      const result = await NyxNative.stopOverlay();
      setIsOverlayActive(false);
      setResponse(result.message);
    });
  };

  const openMediaControlSettings = async () => {
    await runSafely(async () => {
      await NyxNative.openMediaControlSettings();
      setResponse(
        'Ative a Nyx na lista e volte ao aplicativo. O conteúdo das notificações não será lido.',
      );
    });
  };

  const listen = async () => {
    await runSafely(async () => {
      const permissionGranted = await requestMicrophonePermission();
      if (!permissionGranted) {
        setResponse(
          'A permissão de microfone é necessária para reconhecer sua fala.',
        );
        return;
      }

      setInteractionState('listening');
      const transcript = await NyxNative.startSpeechRecognition();
      await processTranscript(transcript, 'main');
    });
  };

  const stopSpeaking = async () => {
    try {
      await nativeSpeechSynthesizer.stop();
    } catch (error) {
      setResponse(errorMessage(error));
    }
  };

  const clearHistory = () => {
    conversationManager.clearHistory();
    setHistory([]);
  };

  const runSafely = async (operation: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await operation();
    } catch (error) {
      setInteractionState('error');
      setResponse(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return {
    activateOverlay,
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
    clearHistory,
    stopSpeaking,
  };
}
