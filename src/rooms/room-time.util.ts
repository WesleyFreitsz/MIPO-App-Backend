const ROOMS_TIME_ZONE = 'America/Sao_Paulo';

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ROOMS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function todayInRoomsTimeZone(now: Date = new Date()): string {
  return zonedParts(now).date;
}

export function minutesNowInRoomsTimeZone(now: Date = new Date()): number {
  return zonedParts(now).minutes;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

export function timeRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB)
  );
}
