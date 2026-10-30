export interface RecommendableGame {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string[] | null;
  isFeatured: boolean;
}

export interface RecommendationSignals {
  games: RecommendableGame[];
  myPlayCounts: Map<string, number>;
  favoriteIds: Set<string>;
  wantsToPlayIds: Set<string>;
  friendPlayers: Map<string, number>;
  ratings: Map<string, { average: number; count: number }>;
}

export interface Recommendation {
  id: string;
  name: string;
  imageUrl: string | null;
  reason: string;
}

const MAX_RECOMMENDATIONS = 10;
const PLAYED_TOO_MUCH = 3;
const MIN_RATINGS = 2;

function categoryAffinity(signals: RecommendationSignals) {
  const affinity = new Map<string, number>();
  const add = (gameId: string, weight: number) => {
    const game = signals.games.find((g) => g.id === gameId);
    for (const category of game?.category ?? []) {
      affinity.set(category, (affinity.get(category) ?? 0) + weight);
    }
  };
  signals.myPlayCounts.forEach((count, gameId) => add(gameId, count));
  signals.favoriteIds.forEach((gameId) => add(gameId, 2));
  return affinity;
}

export function recommendGames(
  signals: RecommendationSignals,
): Recommendation[] {
  const affinity = categoryAffinity(signals);
  const maxAffinity = Math.max(0, ...affinity.values());

  const scored = signals.games.flatMap((game) => {
    const timesPlayed = signals.myPlayCounts.get(game.id) ?? 0;
    if (timesPlayed >= PLAYED_TOO_MUCH) return [];

    const topCategory = (game.category ?? [])
      .map((category) => ({ category, value: affinity.get(category) ?? 0 }))
      .sort((a, b) => b.value - a.value)[0];
    const friends = signals.friendPlayers.get(game.id) ?? 0;
    const rating = signals.ratings.get(game.id);

    const parts = [
      {
        score: signals.wantsToPlayIds.has(game.id) ? 5 : 0,
        reason: 'Está na sua lista de quero jogar',
      },
      {
        score: friends * 2,
        reason: friends === 1 ? 'Um amigo jogou' : `${friends} amigos jogaram`,
      },
      {
        score:
          topCategory && maxAffinity > 0
            ? (topCategory.value / maxAffinity) * 4
            : 0,
        reason: `Porque você curte ${topCategory?.category ?? ''}`,
      },
      {
        score:
          rating && rating.count >= MIN_RATINGS
            ? Math.max(0, rating.average - 3)
            : 0,
        reason: 'Bem avaliado pela galera',
      },
    ];
    const best = parts.reduce((a, b) => (b.score > a.score ? b : a));
    const score =
      parts.reduce((sum, part) => sum + part.score, 0) - timesPlayed * 2;
    if (best.score <= 0 || score <= 0) return [];
    return [{ game, score, reason: best.reason }];
  });

  if (scored.length === 0) {
    return signals.games
      .filter(
        (game) =>
          game.isFeatured &&
          (signals.myPlayCounts.get(game.id) ?? 0) < PLAYED_TOO_MUCH,
      )
      .slice(0, MAX_RECOMMENDATIONS)
      .map((game) => ({
        id: game.id,
        name: game.name,
        imageUrl: game.imageUrl,
        reason: 'Destaque da Mipo',
      }));
  }

  return scored
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name))
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ game, reason }) => ({
      id: game.id,
      name: game.name,
      imageUrl: game.imageUrl,
      reason,
    }));
}
