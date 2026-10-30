const HOUR_MS = 60 * 60 * 1000;

export type EventReminderKind = '24h' | '1h';

export interface EventReminderState {
  dateTime: Date;
  reminder24hSentAt: Date | null;
  reminder1hSentAt: Date | null;
}

export function dueReminder(
  event: EventReminderState,
  now: Date,
): EventReminderKind | null {
  const msUntilStart = new Date(event.dateTime).getTime() - now.getTime();
  if (msUntilStart <= 0) return null;
  if (msUntilStart <= HOUR_MS) return event.reminder1hSentAt ? null : '1h';
  if (msUntilStart <= 24 * HOUR_MS) {
    return event.reminder24hSentAt ? null : '24h';
  }
  return null;
}
