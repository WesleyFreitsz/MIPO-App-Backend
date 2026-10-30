export const FRIEND_ARRIVAL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function shouldAnnounceArrival(
  previousCheckInAt: Date | null | undefined,
  now = new Date(),
) {
  return (
    !previousCheckInAt ||
    now.getTime() - previousCheckInAt.getTime() >= FRIEND_ARRIVAL_COOLDOWN_MS
  );
}
