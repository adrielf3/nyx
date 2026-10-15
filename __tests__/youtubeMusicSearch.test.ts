import {
  buildYouTubeMusicSearchUrl,
  formatYouTubeMusicQuery,
} from '../src/music/youtubeMusicSearch';

describe('youtubeMusicSearch', () => {
  it('combina título e artista em uma busca legível', () => {
    expect(
      formatYouTubeMusicQuery({
        title: ' Blinding Lights ',
        artist: ' The Weeknd ',
      }),
    ).toBe('Blinding Lights The Weeknd');
  });

  it('codifica espaços, acentos e caracteres especiais', () => {
    expect(
      buildYouTubeMusicSearchUrl({
        title: 'Águas & Março',
        artist: 'Elis/Jobim',
      }),
    ).toBe(
      'https://music.youtube.com/search?q=%C3%81guas%20%26%20Mar%C3%A7o%20Elis%2FJobim',
    );
  });

  it('recusa uma busca vazia', () => {
    expect(() => buildYouTubeMusicSearchUrl({ title: '   ' })).toThrow(
      'Informe o nome da música',
    );
  });
});
