import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/users/entities/user.entity';
import { RolesGuard } from './roles.guard';

function contextFor(role?: UserRole): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { userId: 'u1', name: 'Ana', role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('libera rotas sem @Roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(true);
  });

  it('bloqueia usuário comum em rota de admin', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia requisição sem usuário em rota de admin', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('libera admin em rota de admin', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });
});
