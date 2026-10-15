import {
  GeminiAiService,
  MAX_AI_HISTORY_MESSAGES,
  parseMusicRecommendation,
} from '../src/ai/GeminiAiService';
import { AiServiceError } from '../src/ai/types';
import type { ConversationMessage } from '../src/conversation/types';

const enabledConfiguration = async () => ({
  enabled: true,
  apiKey: 'test-key',
});

function message(
  id: number,
  role: ConversationMessage['role'],
): ConversationMessage {
  return { id, role, content: `mensagem ${id}`, createdAt: id };
}

function clientWithGenerate(generate: jest.Mock) {
  return {
    generate,
    generateRecommendation: jest.fn(),
  };
}

describe('GeminiAiService', () => {
  let consoleWarning: jest.SpyInstance;

  beforeEach(() => {
    consoleWarning = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarning.mockRestore();
  });

  it('desabilita somente a IA quando a chave está ausente', async () => {
    const clientFactory = jest.fn();
    const service = new GeminiAiService(
      async () => ({ enabled: false, apiKey: '' }),
      clientFactory,
    );

    await expect(
      service.generateReply({ message: 'Olá', history: [] }),
    ).rejects.toMatchObject({ code: 'disabled' });
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('envia somente o limite recente de mensagens e ignora ferramentas', async () => {
    const generate = jest.fn().mockResolvedValue('  Resposta curta.  ');
    const service = new GeminiAiService(enabledConfiguration, async () =>
      clientWithGenerate(generate),
    );
    const history = Array.from({ length: 10 }, (_, index) =>
      message(
        index + 1,
        index === 7 ? 'tool' : index % 2 ? 'assistant' : 'user',
      ),
    );

    await expect(
      service.generateReply({ message: 'Pergunta atual', history }),
    ).resolves.toBe('Resposta curta.');

    const sentHistory = generate.mock.calls[0][1];
    expect(sentHistory).toHaveLength(MAX_AI_HISTORY_MESSAGES);
    expect(sentHistory).not.toContainEqual(
      expect.objectContaining({ text: 'mensagem 8' }),
    );
  });

  it('classifica cota excedida sem repetir a requisição', async () => {
    const generate = jest.fn().mockRejectedValue({
      status: 429,
      message: 'RESOURCE_EXHAUSTED',
    });
    const service = new GeminiAiService(enabledConfiguration, async () =>
      clientWithGenerate(generate),
    );

    await expect(
      service.generateReply({ message: 'Olá', history: [] }),
    ).rejects.toMatchObject({ code: 'quota_exceeded' });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(consoleWarning).toHaveBeenCalledWith(
      '[NyxGemini]',
      expect.stringContaining('"category":"quota_exceeded"'),
    );
  });

  it('rejeita respostas vazias sem quebrar o contrato', async () => {
    const service = new GeminiAiService(enabledConfiguration, async () =>
      clientWithGenerate(jest.fn().mockResolvedValue('   ')),
    );

    await expect(
      service.generateReply({ message: 'Olá', history: [] }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceError>>({
        code: 'invalid_response',
      }),
    );
  });

  it.each([
    [{ status: 401, message: 'API key invalid' }, 'invalid_key'],
    [new TypeError('Network request failed'), 'network'],
    [new Error('Request timeout'), 'timeout'],
  ] as const)('classifica falha %p como %s', async (failure, code) => {
    const service = new GeminiAiService(enabledConfiguration, async () =>
      clientWithGenerate(jest.fn().mockRejectedValue(failure)),
    );

    await expect(
      service.generateReply({ message: 'Olá', history: [] }),
    ).rejects.toMatchObject({ code });
  });

  it('valida uma recomendação musical estruturada', () => {
    expect(
      parseMusicRecommendation(
        JSON.stringify({
          type: 'music_recommendation',
          title: 'Numb',
          artist: 'Linkin Park',
          album: 'Meteora',
          reason: 'Uma faixa intensa e marcante.',
        }),
      ),
    ).toMatchObject({ title: 'Numb', artist: 'Linkin Park' });
  });

  it('gera e valida recomendação usando o mesmo cliente configurado', async () => {
    const generateRecommendation = jest.fn().mockResolvedValue(
      JSON.stringify({
        type: 'music_recommendation',
        title: 'Numb',
        artist: 'Linkin Park',
        album: 'Meteora',
        reason: 'Uma faixa intensa.',
      }),
    );
    const service = new GeminiAiService(enabledConfiguration, async () => ({
      generate: jest.fn(),
      generateRecommendation,
    }));

    await expect(
      service.generateMusicRecommendation({
        message: 'Me indica uma música',
        history: [],
      }),
    ).resolves.toMatchObject({ title: 'Numb', artist: 'Linkin Park' });
    expect(generateRecommendation).toHaveBeenCalledTimes(1);
  });

  it('converte recomendação malformada em erro controlado', async () => {
    const service = new GeminiAiService(enabledConfiguration, async () => ({
      generate: jest.fn(),
      generateRecommendation: jest.fn().mockResolvedValue('{inválido'),
    }));

    await expect(
      service.generateMusicRecommendation({ message: 'Indique', history: [] }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('classifica falha de rede durante uma recomendação', async () => {
    const service = new GeminiAiService(enabledConfiguration, async () => ({
      generate: jest.fn(),
      generateRecommendation: jest
        .fn()
        .mockRejectedValue(new TypeError('Network request failed')),
    }));

    await expect(
      service.generateMusicRecommendation({ message: 'Indique', history: [] }),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it.each([
    ['texto livre'],
    [
      JSON.stringify({
        type: 'music_recommendation',
        artist: 'Artista',
        reason: 'Motivo',
      }),
    ],
    [
      JSON.stringify({
        type: 'music_recommendation',
        title: 'Faixa',
        reason: 'Motivo',
      }),
    ],
  ])('recusa recomendação inválida: %s', rawResponse => {
    expect(() => parseMusicRecommendation(rawResponse)).toThrow(
      expect.objectContaining({ code: 'invalid_response' }),
    );
  });
});
