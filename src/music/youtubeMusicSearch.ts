export type YouTubeMusicQuery = {
  title: string;
  artist?: string;
};

export function formatYouTubeMusicQuery({
  title,
  artist,
}: YouTubeMusicQuery): string {
  return [title.trim(), artist?.trim()].filter(Boolean).join(' ');
}

export function buildYouTubeMusicSearchUrl(query: YouTubeMusicQuery): string {
  const searchTerm = formatYouTubeMusicQuery(query);
  if (!searchTerm) {
    throw new Error('Informe o nome da música para pesquisar.');
  }

  return `https://music.youtube.com/search?q=${encodeURIComponent(searchTerm)}`;
}
