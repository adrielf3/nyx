import {
  interpretCommand,
  normalizeCommandText,
} from '../src/commands/commandInterpreter';

describe('normalizeCommandText', () => {
  it('normaliza acentos, caixa, pontuação e espaços', () => {
    expect(normalizeCommandText('  NYX,   Ábre o NAVEGADOR! ')).toBe(
      'nyx abre o navegador',
    );
  });
});

describe('interpretCommand', () => {
  it.each([
    ['Nyx, abre o YouTube.', 'youtube'],
    ['Abre o Chrome.', 'chrome'],
    ['Abre o navegador.', 'chrome'],
    ['Abra o Google Maps', 'maps'],
    ['abrir Gmail por favor', 'gmail'],
  ] as const)('interpreta “%s”', (command, appId) => {
    expect(interpretCommand(command)).toMatchObject({
      type: 'open_app',
      appId,
    });
  });

  it('não transforma texto desconhecido em ação', () => {
    expect(interpretCommand('envie todas as minhas mensagens')).toEqual({
      type: 'unknown',
      normalizedText: 'envie todas as minhas mensagens',
    });
  });

  it('abre o YouTube Music sem confundir com o YouTube', () => {
    expect(interpretCommand('Nyx, abre o YouTube Music.')).toEqual({
      type: 'open_youtube_music',
    });
  });

  it('extrai título e artista de um pedido de reprodução', () => {
    expect(
      interpretCommand('Nyx, toca Blinding Lights, do The Weeknd.'),
    ).toEqual({
      type: 'play_youtube_music',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
    });
  });

  it('extrai o artista quando o reconhecimento remove a vírgula', () => {
    expect(interpretCommand('Nyx toca Numb do Linkin Park')).toEqual({
      type: 'play_youtube_music',
      title: 'Numb',
      artist: 'Linkin Park',
    });
  });

  it.each([
    ['toca numb do linkin park', 'numb', 'linkin park'],
    ['toca numb, do linkin park', 'numb', 'linkin park'],
    ['quero ouvir numb do linkin park', 'numb', 'linkin park'],
    ['coloca blinding lights do the weeknd', 'blinding lights', 'the weeknd'],
    ['toca numb de linkin park', 'numb', 'linkin park'],
    ['toca Malandragem da Cássia Eller', 'Malandragem', 'Cássia Eller'],
  ] as const)(
    'interpreta a transcrição sem depender de pontuação: “%s”',
    (command, title, artist) => {
      expect(interpretCommand(command)).toEqual({
        type: 'play_youtube_music',
        title,
        artist,
      });
    },
  );

  it('normaliza espaços e pontuação sem perder a grafia dos parâmetros', () => {
    expect(interpretCommand('  ToCa   Numb,   DO   Linkin Park!!!  ')).toEqual({
      type: 'play_youtube_music',
      title: 'Numb',
      artist: 'Linkin Park',
    });
  });

  it('usa o último conector para não cortar palavras do título', () => {
    expect(interpretCommand('toca Tempo de Festa do Ivete Sangalo')).toEqual({
      type: 'play_youtube_music',
      title: 'Tempo de Festa',
      artist: 'Ivete Sangalo',
    });
  });

  it('pede esclarecimento em vez de interpretar um título ambíguo', () => {
    expect(interpretCommand('toca Águas de Março')).toEqual({
      type: 'clarify_music_metadata',
      query: 'Águas de Março',
      possibleTitle: 'Águas',
      possibleArtist: 'Março',
    });
  });

  it('aceita artista omitido sem inventar um valor', () => {
    expect(interpretCommand('toca Numb')).toEqual({
      type: 'play_youtube_music',
      title: 'Numb',
      artist: undefined,
    });
  });

  it('mantém a capitalização original do termo pesquisado', () => {
    expect(interpretCommand('Nyx, pesquisa Águas de Março.')).toEqual({
      type: 'search_youtube_music',
      title: 'Águas de Março',
    });
  });

  it.each([
    ['pause a música', 'pause'],
    ['continue a música', 'resume'],
    ['próxima música', 'next'],
    ['anterior', 'previous'],
    ['pare a música', 'stop'],
  ] as const)('interpreta o controle local “%s”', (command, action) => {
    expect(interpretCommand(command)).toEqual({
      type: 'media_control',
      action,
    });
  });

  it('pede esclarecimento quando não há uma música identificável', () => {
    expect(interpretCommand('Nyx, toca aquela música.')).toEqual({
      type: 'clarify_music_request',
    });
  });

  it('reconhece variações de reprodução sem perder os metadados', () => {
    expect(interpretCommand('Coloca Blinding Lights, do The Weeknd.')).toEqual({
      type: 'play_youtube_music',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
    });
    expect(interpretCommand('Quero ouvir Numb, do Linkin Park.')).toEqual({
      type: 'play_youtube_music',
      title: 'Numb',
      artist: 'Linkin Park',
    });
  });

  it('separa recomendação e confirmação de comandos de reprodução', () => {
    expect(interpretCommand('Nyx, me indica uma música para ouvir.')).toEqual({
      type: 'recommend_music',
    });
    expect(interpretCommand('Sim, quero ouvir essa música.')).toEqual({
      type: 'confirm_music_recommendation',
    });
  });

  it('solicita esclarecimento quando o título está vazio', () => {
    expect(interpretCommand('Nyx, toca.')).toEqual({
      type: 'clarify_music_request',
    });
  });
});
