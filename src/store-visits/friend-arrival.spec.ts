import { shouldAnnounceArrival } from './friend-arrival';

describe('shouldAnnounceArrival', () => {
  const now = new Date('2026-10-30T20:00:00Z');
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 60 * 60 * 1000);

  it('avisa na primeira visita', () => {
    expect(shouldAnnounceArrival(null, now)).toBe(true);
  });

  it('não repete o aviso se a pessoa voltou em menos de 6h', () => {
    expect(shouldAnnounceArrival(hoursAgo(2), now)).toBe(false);
    expect(shouldAnnounceArrival(hoursAgo(5.9), now)).toBe(false);
  });

  it('avisa de novo depois de 6h', () => {
    expect(shouldAnnounceArrival(hoursAgo(6), now)).toBe(true);
    expect(shouldAnnounceArrival(hoursAgo(30), now)).toBe(true);
  });
});
