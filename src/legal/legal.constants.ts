export const LEGAL_VERSION = '2026-10-30';
export const MIN_AGE = 18;
export const AGE_VERIFICATION_SELF_DECLARED = 'SELF_DECLARED_BIRTHDATE';
const STORE_TIME_ZONE = 'America/Sao_Paulo';

function todayInStoreTimeZone(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

export function ageOn(birthDate: string, now = new Date()) {
  const [year, month, day] = birthDate.slice(0, 10).split('-').map(Number);
  const today = todayInStoreTimeZone(now);
  const hadBirthday =
    today.month > month || (today.month === month && today.day >= day);
  return today.year - year - (hadBirthday ? 0 : 1);
}

export function isAllowedAge(birthDate: string, now = new Date()) {
  const age = ageOn(birthDate, now);
  return age >= MIN_AGE && age <= 120;
}
