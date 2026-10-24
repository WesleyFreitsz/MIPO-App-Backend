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

const hashCode = (code: string) =>
  createHash('sha256').update(code).digest('hex');

describe('AuthService', () => {
  let usersRepository: jest.Mocked<
    Pick<Repository<User>, 'findOne' | 'update' | 'create' | 'save'>
  >;
  let mailService: jest.Mocked<Pick<MailService, 'sendRecoveryCode'>>;
  let service: AuthService;

  beforeEach(() => {
    usersRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mailService = { sendRecoveryCode: jest.fn() };
    const jwtService = { sign: jest.fn().mockReturnValue('token') };

    service = new AuthService(
      usersRepository as unknown as Repository<User>,
      jwtService as unknown as JwtService,
      mailService as unknown as MailService,
    );
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
});
