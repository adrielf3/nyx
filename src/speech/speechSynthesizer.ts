import { NyxNative, type TextToSpeechStatus } from '../native/NyxNative';

export interface SpeechSynthesizer {
  getStatus(): Promise<TextToSpeechStatus>;
  speak(text: string): Promise<void>;
  stop(): Promise<boolean>;
}

export const nativeSpeechSynthesizer: SpeechSynthesizer = {
  getStatus: () => NyxNative.getTextToSpeechStatus(),
  speak: text => NyxNative.speak(text),
  stop: () => NyxNative.stopSpeaking(),
};
