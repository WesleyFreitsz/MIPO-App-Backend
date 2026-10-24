import { calculateSalinhaPrice, SALINHA_HOURLY_RATE } from './rooms.service';
import {
  minutesNowInRoomsTimeZone,
  normalizeTime,
  timeRangesOverlap,
  todayInRoomsTimeZone,
} from './room-time.util';

describe('Regras de horário das salas', () => {
  it('calcula o preço da salinha igual ao app', () => {
    expect(calculateSalinhaPrice('14:00', '16:00')).toBe(
      2 * SALINHA_HOURLY_RATE,
    );
    expect(calculateSalinhaPrice('14:00', '14:30')).toBe(SALINHA_HOURLY_RATE);
  });

  it('detecta sobreposição considerando minutos', () => {
    expect(timeRangesOverlap('14:00', '15:30', '15:00', '16:00')).toBe(true);
    expect(timeRangesOverlap('14:00', '15:00', '15:00', '16:00')).toBe(false);
    expect(timeRangesOverlap('14:30', '15:00', '14:00', '14:45')).toBe(true);
  });

  it('normaliza horário vindo do Postgres', () => {
    expect(normalizeTime('14:00:00')).toBe('14:00');
  });

  it('usa o fuso de São Paulo para a data de hoje', () => {
    const lateNightUtc = new Date('2026-03-11T01:30:00Z');
    expect(todayInRoomsTimeZone(lateNightUtc)).toBe('2026-03-10');
    expect(minutesNowInRoomsTimeZone(lateNightUtc)).toBe(22 * 60 + 30);
  });
});
