import { ConversationManager } from '../src/conversation/ConversationManager';
import { interpretCommand } from '../src/commands/commandInterpreter';
import type { InteractionState } from '../src/conversation/types';

function createCallbacks(states: InteractionState[]) {
  return {
    onResponse: jest.fn(),
    onStateChange: jest.fn((state: InteractionState) => {
      states.push(state);
    }),
  };
}

function createAiService(generateReply = jest.fn()) {
  return {
    generateReply,
    generateMusicRecommendation: jest.fn(),
  };
}

describe('ConversationManager', () => {
  it('executa, responde e fala em uma sequência centralizada', async () => {
    const states: InteractionState[] = [];
    const speak = jest.fn().mockResolvedValue(undefined);
    const generateReply = jest.fn();
    const manager = new ConversationManager({
      interpret: () => ({
        type: 'open_app',
        appId: 'youtube',
        appName: 'YouTube',
      }),
      execute: jest.fn().mockResolvedValue({
        success: true,
        message: 'Aplicativo aberto.',
        response: 'Abrindo YouTube.',
      }),
      generateResponse: () => 'Pronto, o YouTube está aberto!',
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak,
        stop: jest.fn(),
      },
      aiService: createAiService(generateReply),
    });

    const result = await manager.handleTranscript(
      'Abra o YouTube',
      createCallbacks(states),
    );

    expect(speak).toHaveBeenCalledWith('Pronto, o YouTube está aberto!');
    expect(generateReply).not.toHaveBeenCalled();
    expect(states).toEqual(['processing', 'speaking', 'success']);
    expect(result).toMatchObject({ state: 'success', speechPlayed: true });
  });

  it('encaminha perguntas abertas para a IA sem chamar ferramentas', async () => {
    const execute = jest.fn();
    const speak = jest.fn().mockResolvedValue(undefined);
    const generateReply = jest
      .fn()
      .mockResolvedValue('A Lua fica a cerca de 384 mil quilômetros.');
    const manager = new ConversationManager({
      interpret: text => ({ type: 'unknown', normalizedText: text }),
      execute,
      generateResponse: () => 'Ainda não sei fazer isso.',
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak,
        stop: jest.fn(),
      },
      aiService: createAiService(generateReply),
    });

    await manager.handleTranscript(
      'Qual é a distância da Lua?',
      createCallbacks([]),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(
      'A Lua fica a cerca de 384 mil quilômetros.',
    );
  });

  it('mantém comandos locais funcionando quando a IA está sem internet', async () => {
    const generateReply = jest
      .fn()
      .mockRejectedValue(new Error('Network request failed'));
    const execute = jest.fn().mockResolvedValue({
      success: true,
      message: 'Aplicativo aberto.',
      response: '',
    });
    const manager = new ConversationManager({
      interpret: () => ({
        type: 'open_app',
        appId: 'chrome',
        appName: 'Chrome',
      }),
      execute,
      generateResponse: () => 'Pronto, o Chrome está aberto!',
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
      },
      aiService: createAiService(generateReply),
    });

    const result = await manager.handleTranscript(
      'Abra o Chrome',
      createCallbacks([]),
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(generateReply).not.toHaveBeenCalled();
    expect(result.state).toBe('success');
  });

  it('preserva a resposta visual quando a voz não está disponível', async () => {
    const manager = new ConversationManager({
      interpret: () => ({
        type: 'open_app',
        appId: 'gmail',
        appName: 'Gmail',
      }),
      execute: jest.fn().mockResolvedValue({
        success: true,
        message: 'Aplicativo aberto.',
        response: '',
      }),
      generateResponse: () => 'Pronto, o Gmail está aberto!',
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak: jest.fn().mockRejectedValue(new Error('TTS indisponível')),
        stop: jest.fn(),
      },
      aiService: createAiService(),
    });

    const result = await manager.handleTranscript(
      'Abra o Gmail',
      createCallbacks([]),
    );

    expect(result).toEqual({
      response: 'Pronto, o Gmail está aberto!',
      state: 'success',
      speechPlayed: false,
      speechError: 'TTS indisponível',
    });
  });

  it('não usa TTS depois que uma música começa a tocar', async () => {
    const speak = jest.fn();
    const manager = new ConversationManager({
      interpret: () => ({
        type: 'play_youtube_music',
        title: 'Numb',
        artist: 'Linkin Park',
      }),
      execute: jest.fn().mockResolvedValue({
        success: true,
        action: 'play',
        message: 'O YouTube Music começou a reproduzir Numb.',
        response: 'O YouTube Music começou a reproduzir Numb.',
        speakResponse: false,
      }),
      generateResponse: (_intent, result) => result.response,
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak,
        stop: jest.fn(),
      },
      aiService: createAiService(),
    });
    const states: InteractionState[] = [];

    const result = await manager.handleTranscript(
      'Toca Numb do Linkin Park',
      createCallbacks(states),
    );

    expect(speak).not.toHaveBeenCalled();
    expect(states).toEqual(['processing', 'success']);
    expect(result.speechPlayed).toBe(false);
  });

  it('executa título e artista separados mesmo sem vírgula na transcrição', async () => {
    const execute = jest.fn().mockResolvedValue({
      success: true,
      action: 'play',
      message: 'O YouTube Music começou a reproduzir Numb.',
      response: 'O YouTube Music começou a reproduzir Numb.',
      speakResponse: false,
    });
    const manager = new ConversationManager({
      interpret: interpretCommand,
      execute,
      generateResponse: (_intent, result) => result.response,
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak: jest.fn(),
        stop: jest.fn(),
      },
      aiService: createAiService(),
    });

    const result = await manager.handleTranscript(
      'toca numb do linkin park',
      createCallbacks([]),
    );

    expect(execute).toHaveBeenCalledWith({
      type: 'play_youtube_music',
      title: 'numb',
      artist: 'linkin park',
    });
    expect(result.state).toBe('success');
  });

  it('preserva a recomendação até a confirmação e executa a mesma faixa', async () => {
    const execute = jest.fn().mockResolvedValue({
      success: true,
      action: 'play_search',
      message: 'Pesquisa aberta.',
      response: 'Pesquisa aberta.',
    });
    const aiService = createAiService();
    aiService.generateMusicRecommendation.mockResolvedValue({
      type: 'music_recommendation',
      title: 'Numb',
      artist: 'Linkin Park',
      album: 'Meteora',
      reason: 'É intensa e marcante.',
    });
    let turn = 0;
    const manager = new ConversationManager({
      interpret: () =>
        turn++ === 0
          ? { type: 'recommend_music' }
          : { type: 'confirm_music_recommendation' },
      execute,
      generateResponse: (_intent, result) => result.response,
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
      },
      aiService,
    });

    const recommendation = await manager.handleTranscript(
      'Me indica uma música',
      createCallbacks([]),
    );
    await manager.handleTranscript('Sim, quero ouvir', createCallbacks([]));

    expect(recommendation.response).toContain('Numb, de Linkin Park');
    expect(execute).toHaveBeenCalledWith({
      type: 'play_youtube_music',
      title: 'Numb',
      artist: 'Linkin Park',
    });
  });

  it('não executa confirmação sem recomendação pendente', async () => {
    const execute = jest.fn();
    const manager = new ConversationManager({
      interpret: () => ({ type: 'confirm_music_recommendation' }),
      execute,
      generateResponse: (_intent, result) => result.response,
      speechSynthesizer: {
        getStatus: jest.fn(),
        speak: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
      },
      aiService: createAiService(),
    });

    const result = await manager.handleTranscript('Sim', createCallbacks([]));

    expect(result.state).toBe('error');
    expect(execute).not.toHaveBeenCalled();
  });
});
