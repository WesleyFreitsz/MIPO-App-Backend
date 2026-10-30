import { PlayCallMode, PlayCallStatus } from './entities/play-call.entity';

export const MAX_OPEN_CALLS_PER_CREATOR = 2;
const HOUR_MS = 60 * 60 * 1000;
const NOW_CALL_TTL_MS = 4 * HOUR_MS;
const SCHEDULED_GRACE_MS = 2 * HOUR_MS;

export interface ExpirableCall {
  mode: PlayCallMode;
  createdAt: Date;
  scheduledFor: Date | null;
}

export function isExpired(
  call: ExpirableCall,
  now: Date,
  creatorInStore: boolean,
) {
  if (call.mode === PlayCallMode.NOW) {
    return (
      !creatorInStore ||
      now.getTime() - call.createdAt.getTime() > NOW_CALL_TTL_MS
    );
  }
  return (
    !!call.scheduledFor &&
    now.getTime() - call.scheduledFor.getTime() > SCHEDULED_GRACE_MS
  );
}

export function statusForMembers(memberCount: number, slotsNeeded: number) {
  return memberCount >= slotsNeeded ? PlayCallStatus.FULL : PlayCallStatus.OPEN;
}
