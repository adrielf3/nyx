import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export type AllowedAppId = 'youtube' | 'chrome' | 'maps' | 'gmail';

export type NativeOperationResult = {
  success: boolean;
  message: string;
  appId?: AllowedAppId;
};

export type MediaControlAction =
  | 'pause'
  | 'resume'
  | 'next'
  | 'previous'
  | 'stop';

export type MusicAction =
  | 'open'
  | 'search'
  | 'play'
  | 'play_search'
  | MediaControlAction;

export type MusicOperationResult = {
  success: boolean;
  action: MusicAction;
  message: string;
  requiresUserInteraction: boolean;
  errorCode?: string;
  status?:
    | 'PLAYBACK_CONFIRMED'
    | 'PLAYBACK_REQUEST_SENT'
    | 'SEARCH_OPENED'
    | 'APP_NOT_INSTALLED'
    | 'NO_COMPATIBLE_HANDLER'
    | 'INVALID_MUSIC_REQUEST'
    | 'PLAYBACK_UNCONFIRMED'
    | 'OPEN_FAILED'
    | 'APP_OPENED'
    | 'MEDIA_CONTROL_SENT';
};

export type OverlayVisualState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'success'
  | 'error';

export type TextToSpeechStatus = {
  available: boolean;
  message: string;
  languageTag?: string;
  voiceName?: string;
};

export type AiConfiguration = {
  enabled: boolean;
  apiKey: string;
};

type OverlayCommandEvent = {
  transcript: string;
};

function isOverlayCommandEvent(value: unknown): value is OverlayCommandEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'transcript' in value &&
    typeof value.transcript === 'string'
  );
}

type NyxNativeModule = {
  hasOverlayPermission(): Promise<boolean>;
  isOverlayRunning(): Promise<boolean>;
  getAiConfiguration(): Promise<AiConfiguration>;
  updateOverlayState(state: OverlayVisualState, message: string): Promise<void>;
  getTextToSpeechStatus(): Promise<TextToSpeechStatus>;
  speak(text: string): Promise<void>;
  stopSpeaking(): Promise<boolean>;
  openOverlaySettings(): Promise<void>;
  startOverlay(): Promise<NativeOperationResult>;
  stopOverlay(): Promise<NativeOperationResult>;
  openAllowedApp(appId: AllowedAppId): Promise<NativeOperationResult>;
  hasMediaControlPermission(): Promise<boolean>;
  openMediaControlSettings(): Promise<void>;
  openYouTubeMusic(): Promise<MusicOperationResult>;
  searchYouTubeMusic(searchUrl: string): Promise<MusicOperationResult>;
  playYouTubeMusic(
    title: string,
    artist: string | null,
  ): Promise<MusicOperationResult>;
  controlYouTubeMusic(
    action: MediaControlAction,
  ): Promise<MusicOperationResult>;
  startSpeechRecognition(): Promise<string>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const OVERLAY_COMMAND_EVENT = 'nyxOverlayVoiceCommand';
const OVERLAY_STOP_SPEAKING_EVENT = 'nyxOverlayStopSpeaking';

function getNativeModule(): NyxNativeModule {
  if (Platform.OS !== 'android') {
    throw new Error(
      'Os recursos nativos do Nyx estão disponíveis apenas no Android.',
    );
  }

  const module = NativeModules.NyxNative as NyxNativeModule | undefined;
  if (!module) {
    throw new Error(
      'O módulo nativo do Nyx não foi carregado. Recompile o aplicativo Android.',
    );
  }
  return module;
}

export const NyxNative = {
  hasOverlayPermission: () => getNativeModule().hasOverlayPermission(),
  isOverlayRunning: () => getNativeModule().isOverlayRunning(),
  getAiConfiguration: () => getNativeModule().getAiConfiguration(),
  updateOverlayState: (state: OverlayVisualState, message: string) =>
    getNativeModule().updateOverlayState(state, message),
  getTextToSpeechStatus: () => getNativeModule().getTextToSpeechStatus(),
  speak: (text: string) => getNativeModule().speak(text),
  stopSpeaking: () => getNativeModule().stopSpeaking(),
  openOverlaySettings: () => getNativeModule().openOverlaySettings(),
  startOverlay: () => getNativeModule().startOverlay(),
  stopOverlay: () => getNativeModule().stopOverlay(),
  openAllowedApp: (appId: AllowedAppId) =>
    getNativeModule().openAllowedApp(appId),
  hasMediaControlPermission: () =>
    getNativeModule().hasMediaControlPermission(),
  openMediaControlSettings: () => getNativeModule().openMediaControlSettings(),
  openYouTubeMusic: () => getNativeModule().openYouTubeMusic(),
  searchYouTubeMusic: (searchUrl: string) =>
    getNativeModule().searchYouTubeMusic(searchUrl),
  playYouTubeMusic: (title: string, artist: string | null) =>
    getNativeModule().playYouTubeMusic(title, artist),
  controlYouTubeMusic: (action: MediaControlAction) =>
    getNativeModule().controlYouTubeMusic(action),
  startSpeechRecognition: () => getNativeModule().startSpeechRecognition(),
  addOverlayCommandListener: (
    listener: (transcript: string) => void,
  ): EmitterSubscription => {
    const nativeModule = getNativeModule();
    const emitter = new NativeEventEmitter(nativeModule);
    return emitter.addListener(
      OVERLAY_COMMAND_EVENT,
      (...args: readonly Object[]) => {
        const event = args[0];
        if (isOverlayCommandEvent(event) && event.transcript.trim()) {
          listener(event.transcript.trim());
        }
      },
    );
  },
  addOverlayStopSpeakingListener: (
    listener: () => void,
  ): EmitterSubscription => {
    const nativeModule = getNativeModule();
    const emitter = new NativeEventEmitter(nativeModule);
    return emitter.addListener(OVERLAY_STOP_SPEAKING_EVENT, listener);
  },
};
