import { PlayCallMode, PlayCallStatus } from './entities/play-call.entity';
import { isExpired, statusForMembers } from './play-calls.rules';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-10-30T20:00:00Z');
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

describe('play-calls rules', () => {
  it('lota quando os membros alcançam as vagas e reabre quando alguém sai', () => {
    expect(statusForMembers(2, 3)).toBe(PlayCallStatus.OPEN);
    expect(statusForMembers(3, 3)).toBe(PlayCallStatus.FULL);
    expect(statusForMembers(2, 3)).toBe(PlayCallStatus.OPEN);
  });

  it('chamado de agora expira com o criador fora da loja ou depois de 4h', () => {
    const call = { mode: PlayCallMode.NOW, scheduledFor: null };
    expect(isExpired({ ...call, createdAt: ago(1) }, now, true)).toBe(false);
    expect(isExpired({ ...call, createdAt: ago(1) }, now, false)).toBe(true);
    expect(isExpired({ ...call, createdAt: ago(5) }, now, true)).toBe(true);
  });

  it('chamado agendado expira 2h depois do horário', () => {
    const call = { mode: PlayCallMode.SCHEDULED, createdAt: ago(48) };
    expect(isExpired({ ...call, scheduledFor: ago(1) }, now, false)).toBe(
      false,
    );
    expect(isExpired({ ...call, scheduledFor: ago(3) }, now, false)).toBe(true);
  });
});
