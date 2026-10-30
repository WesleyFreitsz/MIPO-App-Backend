import { dueReminder } from './event-reminders';

const now = new Date('2026-11-01T12:00:00Z');
const inHours = (hours: number) =>
  new Date(now.getTime() + hours * 60 * 60 * 1000);

describe('dueReminder', () => {
  const pending = { reminder24hSentAt: null, reminder1hSentAt: null };

  it('dispara 24h dentro da janela de um dia', () => {
    expect(dueReminder({ ...pending, dateTime: inHours(20) }, now)).toBe('24h');
  });

  it('prefere o lembrete de 1h quando o evento está perto, mesmo sem o de 24h', () => {
    expect(dueReminder({ ...pending, dateTime: inHours(0.5) }, now)).toBe('1h');
  });

  it('não repete lembrete já enviado', () => {
    expect(
      dueReminder(
        { ...pending, reminder24hSentAt: now, dateTime: inHours(20) },
        now,
      ),
    ).toBeNull();
    expect(
      dueReminder(
        { ...pending, reminder1hSentAt: now, dateTime: inHours(0.5) },
        now,
      ),
    ).toBeNull();
  });

  it('ignora eventos distantes ou já começados', () => {
    expect(dueReminder({ ...pending, dateTime: inHours(30) }, now)).toBeNull();
    expect(dueReminder({ ...pending, dateTime: inHours(-1) }, now)).toBeNull();
  });
});
