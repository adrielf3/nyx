import type { CommandIntent } from '../commands/commandInterpreter';
import { buildYouTubeMusicSearchUrl } from '../music/youtubeMusicSearch';
import { NyxNative, type NativeOperationResult } from '../native/NyxNative';

export type ToolResult = NativeOperationResult & {
  response: string;
  action?: string;
  requiresUserInteraction?: boolean;
  errorCode?: string;
  speakResponse?: boolean;
};

export async function executeIntent(
  intent: CommandIntent,
): Promise<ToolResult> {
  switch (intent.type) {
    case 'unknown':
      return {
        success: false,
        message: 'Comando desconhecido.',
        response:
          'Ainda não entendi esse comando. Tente pedir para abrir um aplicativo ou controlar o YouTube Music.',
      };
    case 'clarify_music_request':
      return {
        success: false,
        message: 'O nome da música não foi informado.',
        response:
          'Qual música você quer ouvir? Diga o título e, se quiser, o artista.',
        requiresUserInteraction: true,
        errorCode: 'E_MUSIC_QUERY_REQUIRED',
      };
    case 'clarify_music_metadata':
      return {
        success: false,
        message: 'Título e artista estão ambíguos.',
        response: `Você quer ouvir “${intent.query}” como título completo ou “${intent.possibleTitle}”, do artista “${intent.possibleArtist}”?`,
        requiresUserInteraction: true,
        errorCode: 'E_MUSIC_METADATA_AMBIGUOUS',
      };
    case 'recommend_music':
    case 'confirm_music_recommendation':
      return {
        success: false,
        message: 'Essa intenção precisa do contexto da conversa.',
        response: 'Não consegui recuperar o contexto da recomendação.',
        errorCode: 'E_CONVERSATION_CONTEXT_REQUIRED',
      };
    case 'open_app': {
      const result = await NyxNative.openAllowedApp(intent.appId);
      return {
        ...result,
        response: result.success
          ? `Abrindo ${intent.appName}.`
          : `Não consegui abrir ${intent.appName}: ${result.message}`,
      };
    }
    case 'open_youtube_music': {
      const result = await NyxNative.openYouTubeMusic();
      return { ...result, response: result.message };
    }
    case 'search_youtube_music': {
      const searchUrl = buildYouTubeMusicSearchUrl(intent);
      const result = await NyxNative.searchYouTubeMusic(searchUrl);
      return { ...result, response: result.message };
    }
    case 'play_youtube_music': {
      const result = await NyxNative.playYouTubeMusic(
        intent.title,
        intent.artist ?? null,
      );
      return {
        ...result,
        response: result.message,
        speakResponse: result.action !== 'play',
      };
    }
    case 'media_control': {
      const result = await NyxNative.controlYouTubeMusic(intent.action);
      return { ...result, response: result.message };
    }
  }
}
