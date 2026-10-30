export const NOTIFICATION_CATEGORIES = [
  'chat',
  'event',
  'friend',
  'post',
  'achievement',
  'monthly-game',
  'order',
  'friend-arrived',
  'lfg',
  'general',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export function notificationCategory(
  data?: Record<string, unknown> | null,
): NotificationCategory {
  const explicit = data?.type;
  if (
    typeof explicit === 'string' &&
    (NOTIFICATION_CATEGORIES as readonly string[]).includes(explicit)
  ) {
    return explicit as NotificationCategory;
  }
  if (data?.chatId) return 'chat';
  if (data?.eventId) return 'event';
  if (data?.postId) return 'post';
  if (data?.achievementId) return 'achievement';
  if (data?.userId) return 'friend';
  return 'general';
}
