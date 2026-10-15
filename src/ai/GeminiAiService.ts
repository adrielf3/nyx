import { GoogleGenAI } from '@google/genai';
import { NyxNative, type AiConfiguration } from '../native/NyxNative';
import { NYX_PERSONALITY_INSTRUCTION } from './personality';
import {
  AiServiceError,
  type AiRequest,
  type AiService,
  type MusicRecommendation,
} from './types';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const MAX_AI_HISTORY_MESSAGES = 6;
const REQUEST_TIMEOUT_MS = 15_000;

type GeminiTurn = {
  role: 'user' | 'model';
  text: string;
};

type GeminiClient = {
  generate(
    message: string,
    history: readonly GeminiTurn[],
  ): Promise<string | undefined>;
  generateRecommendation(
    message: string,
    history: readonly GeminiTurn[],
  ): Promise<string | undefined>;
};

type ConfigurationProvider = () => Promise<AiConfiguration>;
type ClientFactory = (apiKey: string) => Promise<GeminiClient>;

async function createOfficialClient(apiKey: string): Promise<GeminiClient> {
  const client = new GoogleGenAI({ apiKey });

  return {
    async generate(message, history) {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          ...history.map(turn => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
          { role: 'user', parts: [{ text: message }] },
        ],
        config: {
          systemInstruction: NYX_PERSONALITY_INSTRUCTION,
          maxOutputTokens: 180,
          httpOptions: {
            timeout: REQUEST_TIMEOUT_MS,
            retryOptions: { attempts: 1 },
          },
        },
      });
      return response.text;
    },
    async generateRecommendation(message, history) {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          ...history.map(turn => ({
            role: turn.role,
            parts: [{ text: turn.text }],
          })),
          { role: 'user', parts: [{ text: message }] },
        ],
        config: {
          systemInstruction: `${NYX_PERSONALITY_INSTRUCTION}\nRecomende exatamente uma música existente. Não inclua URLs nem identificadores.`,
          maxOutputTokens: 220,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['music_recommendation'] },
              title: { type: 'string' },
              artist: { type: 'string' },
              album: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['type', 'title', 'artist', 'reason'],
            additionalProperties: false,
          },
          httpOptions: {
            timeout: REQUEST_TIMEOUT_MS,
            retryOptions: { attempts: 1 },
          },
        },
      });
      return response.text;
    },
  };
}

export class GeminiAiService implements AiService {
  private clientPromise?: Promise<GeminiClient>;

  constructor(
    private readonly configurationProvider: ConfigurationProvider = NyxNative.getAiConfiguration,
    private readonly clientFactory: ClientFactory = createOfficialClient,
  ) {}

  async generateReply({ message, history }: AiRequest): Promise<string> {
    return this.withClient(async client => {
      const response = (
        await client.generate(message.trim(), toGeminiHistory(history))
      )?.trim();
      if (!response) {
        throw new AiServiceError(
          'invalid_response',
          'A Gemini retornou uma resposta vazia.',
        );
      }
      return response;
    });
  }

  async generateMusicRecommendation({
    message,
    history,
  }: AiRequest): Promise<MusicRecommendation> {
    return this.withClient(async client => {
      const rawResponse = (
        await client.generateRecommendation(
          message.trim(),
          toGeminiHistory(history),
        )
      )?.trim();
      if (!rawResponse) {
        throw new AiServiceError(
          'invalid_response',
          'A Gemini não retornou uma recomendação.',
        );
      }
      return parseMusicRecommendation(rawResponse);
    });
  }

  private async withClient<T>(
    operation: (client: GeminiClient) => Promise<T>,
  ): Promise<T> {
    const configuration = await this.configurationProvider();
    if (!configuration.enabled || !configuration.apiKey.trim()) {
      throw new AiServiceError(
        'disabled',
        'A chave da Gemini não foi configurada.',
      );
    }

    try {
      this.clientPromise ??= this.clientFactory(configuration.apiKey);
      const client = await this.clientPromise;
      return await operation(client);
    } catch (error) {
      const classifiedError =
        error instanceof AiServiceError ? error : classifyGeminiError(error);
      logGeminiFailure(error, classifiedError.code);
      throw classifiedError;
    }
  }
}

export function parseMusicRecommendation(
  rawResponse: string,
): MusicRecommendation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    throw new AiServiceError(
      'invalid_response',
      'A recomendação musical retornou um formato inválido.',
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AiServiceError(
      'invalid_response',
      'A recomendação musical é inválida.',
    );
  }
  const candidate = parsed as Record<string, unknown>;
  const title =
    typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const artist =
    typeof candidate.artist === 'string' ? candidate.artist.trim() : '';
  const reason =
    typeof candidate.reason === 'string' ? candidate.reason.trim() : '';
  const album =
    typeof candidate.album === 'string' ? candidate.album.trim() : '';
  if (
    candidate.type !== 'music_recommendation' ||
    !title ||
    !artist ||
    !reason
  ) {
    throw new AiServiceError(
      'invalid_response',
      'A recomendação musical está incompleta.',
    );
  }
  return {
    type: 'music_recommendation',
    title,
    artist,
    reason,
    ...(album ? { album } : {}),
  };
}

function toGeminiHistory(
  history: readonly AiRequest['history'][number][],
): GeminiTurn[] {
  return history
    .filter(message => message.role !== 'tool')
    .slice(-MAX_AI_HISTORY_MESSAGES)
    .map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      text: message.content,
    }));
}

function classifyGeminiError(error: unknown): AiServiceError {
  const details = getErrorDetails(error);
  const normalized = details.message.toLocaleLowerCase('en-US');

  if (
    details.status === 429 ||
    /quota|resource_exhausted|rate.limit/.test(normalized)
  ) {
    return new AiServiceError('quota_exceeded', details.message);
  }
  if (
    details.status === 401 ||
    details.status === 403 ||
    /api.key|api_key|unauthenticated|permission.denied/.test(normalized)
  ) {
    return new AiServiceError('invalid_key', details.message);
  }
  if (/abort|timeout|timed.out/.test(normalized)) {
    return new AiServiceError('timeout', details.message);
  }
  if (/fetch|network|internet|connection|offline/.test(normalized)) {
    return new AiServiceError('network', details.message);
  }
  return new AiServiceError('api_error', details.message);
}

function getErrorDetails(error: unknown): { message: string; status?: number } {
  if (typeof error !== 'object' || error === null) {
    return { message: String(error) };
  }

  const candidate = error as {
    message?: unknown;
    status?: unknown;
    code?: unknown;
  };
  return {
    message:
      typeof candidate.message === 'string'
        ? candidate.message
        : 'Erro desconhecido da Gemini.',
    status:
      typeof candidate.status === 'number'
        ? candidate.status
        : typeof candidate.code === 'number'
        ? candidate.code
        : undefined,
  };
}

function logGeminiFailure(error: unknown, category: string): void {
  const details = getErrorDetails(error);
  const name =
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string'
      ? error.name
      : 'Error';
  const sanitizedMessage = details.message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 500);

  console.warn(
    '[NyxGemini]',
    JSON.stringify({
      category,
      name,
      status: details.status,
      message: sanitizedMessage,
    }),
  );
}

export const geminiAiService: AiService = new GeminiAiService();
