import type { ConversationMessage } from '../conversation/types';

export type AiRequest = {
  message: string;
  history: readonly ConversationMessage[];
};

export type MusicRecommendation = {
  type: 'music_recommendation';
  title: string;
  artist: string;
  album?: string;
  reason: string;
};

export interface AiService {
  generateReply(request: AiRequest): Promise<string>;
  generateMusicRecommendation(request: AiRequest): Promise<MusicRecommendation>;
}

export type AiErrorCode =
  | 'disabled'
  | 'invalid_key'
  | 'quota_exceeded'
  | 'timeout'
  | 'network'
  | 'invalid_response'
  | 'api_error';

export class AiServiceError extends Error {
  constructor(readonly code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}
