import {
  aggregateVisitStats,
  storeMonthRange,
  VisitForStats,
} from './store-visits.stats';

const ana = { id: 'ana', name: 'Ana', nickname: null, avatarUrl: null };
const bia = { id: 'bia', name: 'Bia', nickname: 'bia', avatarUrl: null };
const visit = (
  user: VisitForStats['user'],
  inAt: string,
  outAt: string | null,
) => ({
  userId: user.id,
  user,
  checkedInAt: new Date(inAt),
  checkedOutAt: outAt ? new Date(outAt) : null,
});

describe('aggregateVisitStats', () => {
  it('ranqueia por dias distintos no fuso da loja e calcula médias', () => {
    const stats = aggregateVisitStats([
      // 23h30 de sexta em São Paulo = sábado 02h30 UTC: conta como sexta
      visit(ana, '2026-10-03T02:30:00Z', '2026-10-03T04:30:00Z'),
      visit(ana, '2026-10-03T01:00:00Z', null),
      visit(bia, '2026-10-10T20:00:00Z', '2026-10-10T21:00:00Z'),
      visit(bia, '2026-10-17T20:00:00Z', '2026-10-17T22:00:00Z'),
    ]);

    expect(stats.totalVisits).toBe(4);
    expect(stats.uniqueVisitors).toBe(2);
    expect(
      stats.ranking.map((r) => [r.user.id, r.distinctDays, r.visits]),
    ).toEqual([
      ['bia', 2, 2],
      ['ana', 1, 2],
    ]);
    expect(stats.ranking[1].avgMinutes).toBe(120);
    expect(stats.avgMinutes).toBe(100);
    expect(stats.byWeekday[5]).toBe(2);
    expect(stats.byHour[23]).toBe(1);
  });

  it('usa a virada do mês no horário de Brasília', () => {
    const { from, to } = storeMonthRange(2026, 12);
    expect(from.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(to.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });
});
