export interface RankableScore {
  userId: string;
  score: number;
  createdAt: Date;
}

export type RankedScore<T extends RankableScore> = T & { position: number };

const MONTHLY_GAMES_TIME_ZONE = 'America/Sao_Paulo';

export function currentMonthlyPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MONTHLY_GAMES_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month') };
}

function isBetter(a: RankableScore, b: RankableScore) {
  if (a.score !== b.score) return a.score > b.score;
  return a.createdAt.getTime() < b.createdAt.getTime();
}

export function rankBestScores<T extends RankableScore>(
  scores: T[],
): RankedScore<T>[] {
  const bestByUser = new Map<string, T>();
  for (const score of scores) {
    const current = bestByUser.get(score.userId);
    if (!current || isBetter(score, current)) {
      bestByUser.set(score.userId, score);
    }
  }
  return [...bestByUser.values()]
    .sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0))
    .map((score, index) => ({ ...score, position: index + 1 }));
}
