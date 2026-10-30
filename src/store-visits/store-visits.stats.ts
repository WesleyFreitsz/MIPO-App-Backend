const STORE_TIME_ZONE = 'America/Sao_Paulo';
// shortcut: Brasil sem horário de verão desde 2019; se voltar, trocar por cálculo de offset via Intl.
const STORE_UTC_OFFSET = '-03:00';
const MINUTE_MS = 60_000;

export interface VisitForStats {
  userId: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  user: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export interface VisitorStats {
  user: VisitForStats['user'];
  visits: number;
  distinctDays: number;
  avgMinutes: number | null;
  lastVisitAt: Date;
}

const localParts = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function storeLocal(date: Date) {
  const parts = Object.fromEntries(
    localParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

export function storeMonthRange(year: number, month: number) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const next =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    from: new Date(`${year}-${pad(month)}-01T00:00:00${STORE_UTC_OFFSET}`),
    to: new Date(
      `${next.year}-${pad(next.month)}-01T00:00:00${STORE_UTC_OFFSET}`,
    ),
  };
}

function durationMinutes(visit: VisitForStats) {
  return visit.checkedOutAt
    ? (visit.checkedOutAt.getTime() - visit.checkedInAt.getTime()) / MINUTE_MS
    : null;
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

export function aggregateVisitStats(visits: VisitForStats[]) {
  const byWeekday = Array<number>(7).fill(0);
  const byHour = Array<number>(24).fill(0);
  const perUser = new Map<
    string,
    { visits: VisitForStats[]; days: Set<string> }
  >();

  for (const visit of visits) {
    const local = storeLocal(visit.checkedInAt);
    byWeekday[local.weekday] += 1;
    byHour[local.hour] += 1;
    const entry = perUser.get(visit.userId) ?? {
      visits: [],
      days: new Set<string>(),
    };
    entry.visits.push(visit);
    entry.days.add(local.day);
    perUser.set(visit.userId, entry);
  }

  const ranking: VisitorStats[] = [...perUser.values()]
    .map(({ visits: userVisits, days }) => ({
      user: userVisits[0].user,
      visits: userVisits.length,
      distinctDays: days.size,
      avgMinutes: average(
        userVisits.map(durationMinutes).filter((m): m is number => m !== null),
      ),
      lastVisitAt: new Date(
        Math.max(...userVisits.map((v) => v.checkedInAt.getTime())),
      ),
    }))
    .sort(
      (a, b) =>
        b.distinctDays - a.distinctDays ||
        b.visits - a.visits ||
        b.lastVisitAt.getTime() - a.lastVisitAt.getTime(),
    );

  return {
    totalVisits: visits.length,
    uniqueVisitors: perUser.size,
    avgMinutes: average(
      visits.map(durationMinutes).filter((m): m is number => m !== null),
    ),
    byWeekday,
    byHour,
    ranking,
  };
}

export function visitStatsToCsv(ranking: VisitorStats[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ranking.map((row, index) =>
    [
      index + 1,
      escape(row.user.name),
      escape(row.user.nickname ?? ''),
      row.distinctDays,
      row.visits,
      row.avgMinutes ?? '',
      row.lastVisitAt.toISOString().slice(0, 10),
    ].join(';'),
  );
  return [
    'posicao;nome;apelido;dias;visitas;media_minutos;ultima_visita',
    ...lines,
  ].join('\n');
}
