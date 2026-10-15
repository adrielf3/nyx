import type { AllowedAppId, MediaControlAction } from '../native/NyxNative';

export type CommandIntent =
  | { type: 'open_app'; appId: AllowedAppId; appName: string }
  | { type: 'open_youtube_music' }
  | { type: 'search_youtube_music'; title: string; artist?: string }
  | { type: 'play_youtube_music'; title: string; artist?: string }
  | { type: 'recommend_music' }
  | { type: 'confirm_music_recommendation' }
  | { type: 'media_control'; action: MediaControlAction }
  | { type: 'clarify_music_request' }
  | {
      type: 'clarify_music_metadata';
      query: string;
      possibleTitle: string;
      possibleArtist: string;
    }
  | { type: 'unknown'; normalizedText: string };

const APP_ALIASES: Record<string, { appId: AllowedAppId; appName: string }> = {
  youtube: { appId: 'youtube', appName: 'YouTube' },
  chrome: { appId: 'chrome', appName: 'Chrome' },
  navegador: { appId: 'chrome', appName: 'Chrome' },
  'google maps': { appId: 'maps', appName: 'Google Maps' },
  maps: { appId: 'maps', appName: 'Google Maps' },
  mapas: { appId: 'maps', appName: 'Google Maps' },
  gmail: { appId: 'gmail', appName: 'Gmail' },
};

const MEDIA_CONTROLS: ReadonlyArray<{
  pattern: RegExp;
  action: MediaControlAction;
}> = [
  { pattern: /^(?:pausa|pause)(?:\s+(?:a\s+)?musica)?$/, action: 'pause' },
  {
    pattern:
      /^(?:continua|continue|retoma|retome|volta a tocar)(?:\s+(?:a\s+)?musica)?$/,
    action: 'resume',
  },
  {
    pattern: /^(?:proxima|avance|pula)(?:\s+(?:a\s+)?musica)?$/,
    action: 'next',
  },
  {
    pattern: /^(?:anterior|volte)(?:\s+(?:a\s+)?musica)?$/,
    action: 'previous',
  },
  {
    pattern: /^(?:pare|parar|encerre)(?:\s+(?:a\s+)?musica)?$/,
    action: 'stop',
  },
];

export function normalizeCommandText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInvocation(text: string): string {
  return text
    .trim()
    .replace(/^(?:ei\s+)?nyx[\s,.:;-]*/iu, '')
    .replace(/[.!?]+$/u, '')
    .replace(/\s+por favor$/iu, '')
    .trim();
}

type MusicQueryResult =
  | { kind: 'parsed'; title: string; artist?: string }
  | {
      kind: 'ambiguous';
      query: string;
      possibleTitle: string;
      possibleArtist: string;
    };

function musicQuery(
  value: string,
  clarifyAmbiguousConnector = false,
): MusicQueryResult | null {
  const cleanValue = value
    .trim()
    .replace(/[.!?]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const normalizedValue = normalizeCommandText(cleanValue);
  if (
    !cleanValue ||
    /^(?:aquela|essa|esta|uma)(?: musica)?$/.test(normalizedValue)
  ) {
    return null;
  }

  const explicitArtistMatch = cleanValue.match(
    /^(.+?),\s*(?:do|da|de)\s+(.+)$/iu,
  );
  if (explicitArtistMatch) {
    const title = explicitArtistMatch[1].trim();
    const artist = explicitArtistMatch[2].trim();
    return title && artist ? { kind: 'parsed', title, artist } : null;
  }

  // O reconhecimento normalmente remove a vírgula. Para não transformar
  // títulos como "Águas de Março" em título+artista, um conector sem vírgula
  // só é separado automaticamente quando o possível artista tem mais de uma
  // palavra. Casos restantes são preservados na busca ou esclarecidos ao tocar.
  const spokenArtistMatch = cleanValue.match(
    /^(.+)\s+(?:do|da|de)\s+([^,]+)$/iu,
  );
  if (spokenArtistMatch) {
    const possibleTitle = spokenArtistMatch[1].trim();
    const possibleArtist = spokenArtistMatch[2].trim();
    const artistWordCount =
      normalizeCommandText(possibleArtist).split(' ').length;
    if (artistWordCount >= 2) {
      return {
        kind: 'parsed',
        title: possibleTitle,
        artist: possibleArtist,
      };
    }
    if (clarifyAmbiguousConnector) {
      return {
        kind: 'ambiguous',
        query: cleanValue,
        possibleTitle,
        possibleArtist,
      };
    }
  }

  return { kind: 'parsed', title: cleanValue };
}

export function interpretCommand(text: string): CommandIntent {
  const commandText = stripInvocation(text);
  const normalizedText = normalizeCommandText(commandText);

  if (
    /^(?:me\s+)?(?:indica|indique|recomenda|recomende)(?:\s+uma)?\s+musica(?:\s+para\s+ouvir)?$/.test(
      normalizedText,
    )
  ) {
    return { type: 'recommend_music' };
  }

  if (
    /^(?:sim(?: eu)?(?: quero)?(?: ouvir)?(?: essa musica)?|gostei da recomendacao(?: pode tocar)?|pode tocar(?: essa musica)?)$/.test(
      normalizedText,
    )
  ) {
    return { type: 'confirm_music_recommendation' };
  }

  if (
    /^(?:abre|abra|abrir)(?:\s+(?:o|a))?\s+youtube music$/.test(normalizedText)
  ) {
    return { type: 'open_youtube_music' };
  }

  const mediaControl = MEDIA_CONTROLS.find(({ pattern }) =>
    pattern.test(normalizedText),
  );
  if (mediaControl) {
    return { type: 'media_control', action: mediaControl.action };
  }

  const searchMatch = commandText.match(
    /^(?:pesquisa|pesquise|busca|buscar)(?:\s+(?:por|(?:a\s+)?m[úu]sica))?\s+(.+)$/iu,
  );
  if (searchMatch) {
    const query = musicQuery(searchMatch[1]);
    return query
      ? {
          type: 'search_youtube_music',
          title: query.kind === 'parsed' ? query.title : query.query,
          ...(query.kind === 'parsed' && query.artist
            ? { artist: query.artist }
            : {}),
        }
      : { type: 'clarify_music_request' };
  }

  const playMatch = commandText.match(
    /^(?:toca|toque|reproduz|reproduza|coloca|coloque|quero ouvir)(?:\s+(?:(?:a\s+)?m[úu]sica))?\s+(.+)$/iu,
  );
  if (playMatch) {
    const query = musicQuery(playMatch[1], true);
    if (!query) {
      return { type: 'clarify_music_request' };
    }
    return query.kind === 'ambiguous'
      ? {
          type: 'clarify_music_metadata',
          query: query.query,
          possibleTitle: query.possibleTitle,
          possibleArtist: query.possibleArtist,
        }
      : {
          type: 'play_youtube_music',
          title: query.title,
          artist: query.artist,
        };
  }

  if (
    /^(?:toca|toque|reproduz|reproduza|coloca|coloque|quero ouvir)$/.test(
      normalizedText,
    )
  ) {
    return { type: 'clarify_music_request' };
  }

  const match = normalizedText.match(
    /^(?:abre|abra|abrir)(?:\s+(?:o|a))?\s+(.+)$/,
  );
  const app = match ? APP_ALIASES[match[1]] : undefined;

  return app
    ? { type: 'open_app', ...app }
    : { type: 'unknown', normalizedText };
}
