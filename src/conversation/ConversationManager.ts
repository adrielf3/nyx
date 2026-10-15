import {
  interpretCommand,
  type CommandIntent,
} from '../commands/commandInterpreter';
import { aiErrorMessage } from '../ai/aiErrorMessage';
import { geminiAiService } from '../ai/GeminiAiService';
import type { AiService, MusicRecommendation } from '../ai/types';
import type { SpeechSynthesizer } from '../speech/speechSynthesizer';
import { executeIntent, type ToolResult } from '../tools/appTools';
import { errorMessage } from '../utils/errorMessage';
import { ConversationHistory } from './ConversationHistory';
import { generateNyxResponse } from './responseGenerator';
import type { ConversationMessage, InteractionState } from './types';

type ConversationDependencies = {
  interpret: (text: string) => CommandIntent;
  execute: (intent: CommandIntent) => Promise<ToolResult>;
  generateResponse: (intent: CommandIntent, result: ToolResult) => string;
  speechSynthesizer: SpeechSynthesizer;
  aiService: AiService;
};

type ConversationCallbacks = {
  onResponse: (response: string) => void;
  onStateChange: (
    state: InteractionState,
    message: string,
  ) => void | Promise<void>;
};

export type ConversationResult = {
  response: string;
  state: Extract<InteractionState, 'success' | 'error'>;
  speechPlayed: boolean;
  speechError?: string;
};

export class ConversationManager {
  private readonly history: ConversationHistory;
  private pendingRecommendation?: MusicRecommendation;

  constructor(
    private readonly dependencies: ConversationDependencies,
    historyLimit = 12,
  ) {
    this.history = new ConversationHistory(historyLimit);
  }

  async handleTranscript(
    transcript: string,
    callbacks: ConversationCallbacks,
  ): Promise<ConversationResult> {
    const cleanTranscript = transcript.trim();
    const previousHistory = this.history.getMessages();
    this.history.add('user', cleanTranscript);
    await callbacks.onStateChange('processing', 'Pensando no que fazer...');

    const intent = this.dependencies.interpret(cleanTranscript);
    logConversationFlow('intent_identified', {
      transcript: cleanTranscript.slice(0, 160),
      intent: intent.type,
      ...(intent.type === 'play_youtube_music'
        ? { title: intent.title, artist: intent.artist }
        : {}),
    });
    let response: string;
    let finalState: Extract<InteractionState, 'success' | 'error'>;
    let shouldSpeak = true;
    if (intent.type === 'recommend_music') {
      try {
        const recommendation =
          await this.dependencies.aiService.generateMusicRecommendation({
            message: cleanTranscript,
            history: previousHistory,
          });
        this.pendingRecommendation = recommendation;
        response = `Recomendo ${recommendation.title}, de ${recommendation.artist}. ${recommendation.reason} Quer ouvir?`;
        finalState = 'success';
        logConversationFlow('recommendation_ready', {
          source: 'gemini',
          title: recommendation.title,
          artist: recommendation.artist,
        });
      } catch (error) {
        response = aiErrorMessage(error);
        finalState = 'error';
      }
    } else if (intent.type === 'confirm_music_recommendation') {
      const recommendation = this.pendingRecommendation;
      if (!recommendation) {
        response =
          'Não tenho uma recomendação pendente. Peça para eu indicar uma música primeiro.';
        finalState = 'error';
      } else {
        this.pendingRecommendation = undefined;
        const playbackIntent: CommandIntent = {
          type: 'play_youtube_music',
          title: recommendation.title,
          artist: recommendation.artist,
        };
        const result = await this.executeSafely(playbackIntent);
        this.history.add('tool', result.message);
        response = this.dependencies.generateResponse(playbackIntent, result);
        finalState = result.success ? 'success' : 'error';
        shouldSpeak = result.speakResponse !== false;
        logConversationFlow('recommendation_playback_result', {
          source: 'gemini_confirmation',
          action: result.action,
          errorCode: result.errorCode,
        });
      }
    } else if (intent.type === 'unknown') {
      try {
        response = await this.dependencies.aiService.generateReply({
          message: cleanTranscript,
          history: previousHistory,
        });
        finalState = 'success';
      } catch (error) {
        response = aiErrorMessage(error);
        finalState = 'error';
      }
    } else {
      const result = await this.executeSafely(intent);
      this.history.add('tool', result.message);
      response = this.dependencies.generateResponse(intent, result);
      finalState = result.success ? 'success' : 'error';
      shouldSpeak = result.speakResponse !== false;
      logConversationFlow('local_tool_result', {
        source: 'local',
        action: result.action ?? intent.type,
        success: result.success,
        errorCode: result.errorCode,
      });
    }

    this.history.add('assistant', response);
    callbacks.onResponse(response);
    logConversationFlow('response_presented', {
      state: finalState,
      response: response.slice(0, 200),
    });

    let speechPlayed = false;
    let speechError: string | undefined;
    if (shouldSpeak) {
      await callbacks.onStateChange('speaking', response);
      try {
        await this.dependencies.speechSynthesizer.speak(response);
        speechPlayed = true;
      } catch (error) {
        speechError = errorMessage(error);
      }
    }

    await callbacks.onStateChange(finalState, response);
    return { response, state: finalState, speechPlayed, speechError };
  }

  getHistory(): readonly ConversationMessage[] {
    return this.history.getMessages();
  }

  clearHistory(): void {
    this.history.clear();
    this.pendingRecommendation = undefined;
  }

  private async executeSafely(intent: CommandIntent): Promise<ToolResult> {
    try {
      return await this.dependencies.execute(intent);
    } catch (error) {
      const failure = errorMessage(error);
      return {
        success: false,
        message: failure,
        response: failure,
      };
    }
  }
}

function logConversationFlow(
  event: string,
  details: Record<string, unknown>,
): void {
  if (__DEV__ && process.env.NODE_ENV !== 'test') {
    console.info('[NyxFlow]', JSON.stringify({ event, ...details }));
  }
}

export function createConversationManager(
  speechSynthesizer: SpeechSynthesizer,
): ConversationManager {
  return new ConversationManager({
    interpret: interpretCommand,
    execute: executeIntent,
    generateResponse: generateNyxResponse,
    speechSynthesizer,
    aiService: geminiAiService,
  });
}
