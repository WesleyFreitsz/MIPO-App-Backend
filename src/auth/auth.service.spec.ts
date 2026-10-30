import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { MailService } from 'src/mail/mail.service';
import { User, UserRole } from 'src/users/entities/user.entity';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AccountDataService } from 'src/users/account-data.service';
import { LEGAL_VERSION } from 'src/legal/legal.constants';

const hashCode = (code: string) =>
  createHash('sha256').update(code).digest('hex');

describe('AuthService', () => {
  let usersRepository: jest.Mocked<
    Pick<Repository<User>, 'findOne' | 'update' | 'create' | 'save'>
  >;
  let refreshTokensRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mailService: jest.Mocked<Pick<MailService, 'sendRecoveryCode'>>;
  let service: AuthService;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    refreshTokensRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((token: Partial<RefreshToken>) => token),
      save: jest.fn(),
    };
    mailService = { sendRecoveryCode: jest.fn() };
    const jwtService = { sign: jest.fn().mockReturnValue('token') };

    service = new AuthService(
      usersRepository as unknown as Repository<User>,
      refreshTokensRepository as unknown as Repository<RefreshToken>,
      jwtService as unknown as JwtService,
      mailService as unknown as MailService,
      {} as AccountDataService,
    );
  });

  describe('register', () => {
    const base = {
      name: 'Ana Souza',
      login: 'ana@mipo.com',
      password: 'segredo1',
      acceptTerms: true,
      termsVersion: LEGAL_VERSION,
    };

    it('recusa menores de 18 anos', async () => {
      const birthDate = `${new Date().getFullYear() - 17}-01-01`;
      await expect(service.register({ ...base, birthDate })).rejects.toThrow(
        BadRequestException,
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('recusa aceite de uma versão antiga dos termos', async () => {
      await expect(
        service.register({
          ...base,
          birthDate: '1990-05-10',
          termsVersion: '2000-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('grava data de nascimento, método de aferição e aceite', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockImplementation((u) => u as User);
      usersRepository.save.mockImplementation((u) =>
        Promise.resolve({ ...u, id: 'u1', role: UserRole.USER } as User),
      );

      await service.register({ ...base, birthDate: '1990-05-10' });

      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          birthDate: '1990-05-10',
          ageVerificationMethod: 'SELF_DECLARED_BIRTHDATE',
          termsVersion: LEGAL_VERSION,
        }),
      );
    });
  });

  describe('login', () => {
    it('rejeita usuário banido mesmo com senha correta', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        role: UserRole.USER,
        password: await bcrypt.hash('segredo1', 4),
        banned: true,
        isProfileComplete: true,
      } as User);

      await expect(
        service.login({ login: 'ana@mipo.com', password: 'segredo1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejeita senha errada', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        password: await bcrypt.hash('segredo1', 4),
        banned: false,
      } as User);

      await expect(
        service.login({ login: 'ana@mipo.com', password: 'errada' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('responde igual quando o e-mail não existe e não envia e-mail', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('ninguem@mipo.com');

      expect(result.message).toContain('Se o e-mail estiver cadastrado');
      expect(mailService.sendRecoveryCode).not.toHaveBeenCalled();
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('guarda apenas o hash do código e zera as tentativas', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        email: 'ana@mipo.com',
        banned: false,
      } as User);

      await service.forgotPassword('ana@mipo.com');

      const sentCode = mailService.sendRecoveryCode.mock.calls[0][2];
      expect(sentCode).toMatch(/^\d{6}$/);
      expect(usersRepository.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          recoveryCode: hashCode(sentCode),
          recoveryAttempts: 0,
        }),
      );
    });
  });

  describe('resetPassword', () => {
    const futureDate = () => new Date(Date.now() + 60_000);

    it('incrementa as tentativas quando o código está errado', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        recoveryCode: hashCode('123456'),
        recoveryCodeExpires: futureDate(),
        recoveryAttempts: 1,
      } as User);

      await expect(
        service.resetPassword({
          email: 'ana@mipo.com',
          code: '000000',
          newPassword: 'novaSenha',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersRepository.update).toHaveBeenCalledWith('u1', {
        recoveryAttempts: 2,
      });
    });

    it('invalida o código ao atingir o limite de tentativas', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        recoveryCode: hashCode('123456'),
        recoveryCodeExpires: futureDate(),
        recoveryAttempts: 4,
      } as User);

      await expect(
        service.resetPassword({
          email: 'ana@mipo.com',
          code: '000000',
          newPassword: 'novaSenha',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersRepository.update).toHaveBeenCalledWith('u1', {
        recoveryAttempts: 5,
        recoveryCode: null,
        recoveryCodeExpires: null,
      });
    });

    it('recusa até o código certo depois de bloqueado', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        recoveryCode: hashCode('123456'),
        recoveryCodeExpires: futureDate(),
        recoveryAttempts: 5,
      } as User);

      await expect(
        service.resetPassword({
          email: 'ana@mipo.com',
          code: '123456',
          newPassword: 'novaSenha',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('troca a senha com o código certo e limpa o código', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        recoveryCode: hashCode('123456'),
        recoveryCodeExpires: futureDate(),
        recoveryAttempts: 0,
      } as User);

      await service.resetPassword({
        email: 'ana@mipo.com',
        code: '123456',
        newPassword: 'novaSenha',
      });

      expect(usersRepository.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          recoveryCode: null,
          recoveryCodeExpires: null,
          recoveryAttempts: 0,
        }),
      );
    });
  });

  describe('refresh', () => {
    const storedToken = (overrides: Partial<RefreshToken> = {}) =>
      ({
        id: 'rt1',
        userId: 'u1',
        tokenHash: hashCode('antigo'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        ...overrides,
      }) as RefreshToken;

    it('rotaciona: revoga o token usado e emite um par novo', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(storedToken());
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        role: UserRole.USER,
        banned: false,
        isProfileComplete: true,
      } as User);

      const result = await service.refresh('antigo');

      expect(refreshTokensRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rt1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
      expect(result.refresh_token).not.toBe('antigo');
      expect(refreshTokensRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: hashCode(result.refresh_token) }),
      );
    });

    it('reuso de token revogado derruba todas as sessões do usuário', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(
        storedToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('antigo')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokensRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
      expect(refreshTokensRepository.save).not.toHaveBeenCalled();
    });

    it('recusa token expirado', async () => {
      refreshTokensRepository.findOne.mockResolvedValue(
        storedToken({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(service.refresh('antigo')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
