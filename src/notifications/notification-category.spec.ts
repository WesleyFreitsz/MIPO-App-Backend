import { notificationCategory } from './notification-category';

describe('notificationCategory', () => {
  it('usa o type explícito quando é uma categoria conhecida', () => {
    expect(notificationCategory({ type: 'monthly-game', eventId: 'e' })).toBe(
      'monthly-game',
    );
  });

  it('infere pela chave do payload quando não há type', () => {
    expect(notificationCategory({ chatId: 'c' })).toBe('chat');
    expect(notificationCategory({ eventId: 'e' })).toBe('event');
    expect(notificationCategory({ userId: 'u' })).toBe('friend');
    expect(notificationCategory({ type: 'ALERT' })).toBe('general');
    expect(notificationCategory()).toBe('general');
  });
});
