import { currentMonthlyPeriod, rankBestScores } from './monthly-games.ranking';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes));

describe('rankBestScores', () => {
  it('keeps the best score per player and breaks ties by who reached it first', () => {
    const ranking = rankBestScores([
      { userId: 'ana', score: 50, createdAt: at(1) },
      { userId: 'ana', score: 80, createdAt: at(5) },
      { userId: 'bia', score: 80, createdAt: at(3) },
      { userId: 'caio', score: 120, createdAt: at(9) },
      { userId: 'bia', score: 10, createdAt: at(10) },
    ]);

    expect(ranking.map((r) => [r.userId, r.score, r.position])).toEqual([
      ['caio', 120, 1],
      ['bia', 80, 2],
      ['ana', 80, 3],
    ]);
  });

  it('returns an empty ranking without scores', () => {
    expect(rankBestScores([])).toEqual([]);
  });
});

describe('currentMonthlyPeriod', () => {
  it('uses the São Paulo month at the turn of the month', () => {
    expect(currentMonthlyPeriod(new Date('2026-11-01T02:00:00Z'))).toEqual({
      year: 2026,
      month: 10,
    });
  });
});
