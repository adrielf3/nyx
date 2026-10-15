import { generateNyxResponse } from '../src/conversation/responseGenerator';

describe('generateNyxResponse', () => {
  it('confirma uma ação realizada', () => {
    expect(
      generateNyxResponse(
        { type: 'open_app', appId: 'youtube', appName: 'YouTube' },
        { success: true, message: 'Aplicativo aberto.', response: '' },
      ),
    ).toBe('Pronto, o YouTube está aberto!');
  });

  it('responde com segurança a comandos desconhecidos', () => {
    expect(
      generateNyxResponse(
        { type: 'unknown', normalizedText: 'faça algo perigoso' },
        { success: false, message: 'Comando desconhecido.', response: '' },
      ),
    ).toBe('Ainda não sei fazer isso. Quer tentar de outro jeito?');
  });

  it('não afirma que uma música começou quando o fallback exige seleção', () => {
    const response =
      'Abri os resultados no YouTube Music. Escolha a música para iniciar a reprodução.';

    expect(
      generateNyxResponse(
        { type: 'play_youtube_music', title: 'Blinding Lights' },
        {
          success: true,
          message: response,
          response,
          requiresUserInteraction: true,
        },
      ),
    ).toBe(response);
  });
});
