import { executeIntent } from '../src/tools/appTools';
import { NyxNative } from '../src/native/NyxNative';

jest.mock('../src/native/NyxNative', () => ({
  NyxNative: {
    openAllowedApp: jest.fn(),
    openYouTubeMusic: jest.fn(),
    searchYouTubeMusic: jest.fn(),
    playYouTubeMusic: jest.fn(),
    controlYouTubeMusic: jest.fn(),
  },
}));

const nativeMock = NyxNative as jest.Mocked<typeof NyxNative>;

describe('executeIntent para YouTube Music', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia título e artista para a reprodução direta com fallback seguro', async () => {
    nativeMock.playYouTubeMusic.mockResolvedValue({
      success: true,
      action: 'play',
      message: 'Enviei Blinding Lights para reprodução no YouTube Music.',
      requiresUserInteraction: false,
    });

    const result = await executeIntent({
      type: 'play_youtube_music',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
    });

    expect(nativeMock.playYouTubeMusic).toHaveBeenCalledWith(
      'Blinding Lights',
      'The Weeknd',
    );
    expect(result).toMatchObject({
      success: true,
      action: 'play',
      requiresUserInteraction: false,
    });
  });

  it('propaga a ausência de uma sessão do YouTube Music', async () => {
    nativeMock.controlYouTubeMusic.mockResolvedValue({
      success: false,
      action: 'pause',
      message: 'Não encontrei uma sessão ativa do YouTube Music.',
      requiresUserInteraction: true,
      errorCode: 'E_NO_YOUTUBE_MUSIC_SESSION',
    });

    await expect(
      executeIntent({ type: 'media_control', action: 'pause' }),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'E_NO_YOUTUBE_MUSIC_SESSION',
    });
  });

  it('propaga quando o YouTube Music não está disponível', async () => {
    nativeMock.openYouTubeMusic.mockResolvedValue({
      success: false,
      action: 'open',
      message: 'O YouTube Music não está instalado ou disponível.',
      requiresUserInteraction: false,
      errorCode: 'E_YOUTUBE_MUSIC_UNAVAILABLE',
    });

    await expect(
      executeIntent({ type: 'open_youtube_music' }),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'E_YOUTUBE_MUSIC_UNAVAILABLE',
    });
  });

  it('propaga uma ação não suportada pela sessão ativa', async () => {
    nativeMock.controlYouTubeMusic.mockResolvedValue({
      success: false,
      action: 'stop',
      message: 'O YouTube Music não disponibilizou esse controle agora.',
      requiresUserInteraction: false,
      errorCode: 'E_MEDIA_ACTION_UNSUPPORTED',
    });

    await expect(
      executeIntent({ type: 'media_control', action: 'stop' }),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'E_MEDIA_ACTION_UNSUPPORTED',
    });
  });

  it('pede o título sem chamar código nativo', async () => {
    const result = await executeIntent({ type: 'clarify_music_request' });

    expect(result.errorCode).toBe('E_MUSIC_QUERY_REQUIRED');
    expect(result.requiresUserInteraction).toBe(true);
    expect(nativeMock.searchYouTubeMusic).not.toHaveBeenCalled();
  });

  it('pede esclarecimento de metadados ambíguos sem chamar o nativo', async () => {
    const result = await executeIntent({
      type: 'clarify_music_metadata',
      query: 'Águas de Março',
      possibleTitle: 'Águas',
      possibleArtist: 'Março',
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: 'E_MUSIC_METADATA_AMBIGUOUS',
      requiresUserInteraction: true,
    });
    expect(nativeMock.playYouTubeMusic).not.toHaveBeenCalled();
  });
});
