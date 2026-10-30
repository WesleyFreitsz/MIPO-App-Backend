import { ageOn, isAllowedAge } from './legal.constants';

describe('idade mínima', () => {
  const now = new Date('2026-10-30T02:00:00Z'); // 29/10 23h em São Paulo

  it('conta o aniversário pelo dia de São Paulo', () => {
    expect(ageOn('2008-10-30', now)).toBe(17);
    expect(ageOn('2008-10-29', now)).toBe(18);
  });

  it('só aceita maiores de 18 com data plausível', () => {
    expect(isAllowedAge('2008-10-29', now)).toBe(true);
    expect(isAllowedAge('2008-10-30', now)).toBe(false);
    expect(isAllowedAge('1890-01-01', now)).toBe(false);
  });
});
