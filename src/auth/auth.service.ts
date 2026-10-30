import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { User } from 'src/users/entities/user.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from 'src/mail/mail.service'; // Importação do novo serviço
import { JwtPayload } from './authenticated-user.interface';
import { RefreshToken } from './entities/refresh-token.entity';
import { ChangePasswordDto } from './dto/account.dto';
import {
  AccountDataService,
  DELETED_ACCOUNT_NAME,
} from 'src/users/account-data.service';
import {
  AGE_VERIFICATION_SELF_DECLARED,
  LEGAL_VERSION,
  MIN_AGE,
  isAllowedAge,
} from 'src/legal/legal.constants';

const RECOVERY_CODE_TTL_MS = 2 * 60 * 1000;
const MAX_RECOVERY_ATTEMPTS = 5;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FORGOT_PASSWORD_MESSAGE =
  'Se o e-mail estiver cadastrado, você receberá um código de recuperação.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokensRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private mailService: MailService, // Injetando o serviço de e-mail
    private accountDataService: AccountDataService,
  ) {}

  // --- REGISTRO ---
  async register(dto: RegisterDto) {
    if (!isAllowedAge(dto.birthDate)) {
      throw new BadRequestException(
        `O Mipo é permitido apenas para maiores de ${MIN_AGE} anos.`,
      );
    }
    if (dto.termsVersion !== LEGAL_VERSION) {
      throw new BadRequestException(
        'Os termos foram atualizados. Abra o cadastro novamente.',
      );
    }
    const login = dto.login.trim();
    const isEmail = login.includes('@');
    const existingUser = await this.usersRepository.findOne({
      where: isEmail ? { email: login } : { phoneNumber: login },
      select: { id: true },
    });

    if (existingUser) throw new ConflictException('Usuário já existe.');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = this.usersRepository.create({
      name: dto.name,
      password: hashedPassword,
      birthDate: dto.birthDate.slice(0, 10),
      ageVerificationMethod: AGE_VERIFICATION_SELF_DECLARED,
      termsVersion: LEGAL_VERSION,
      termsAcceptedAt: new Date(),
      email: isEmail ? login : null,
      phoneNumber: !isEmail ? login : null,
    });

    const savedUser = await this.usersRepository.save(newUser);
    return this.issueTokens(savedUser);
  }

  // --- LOGIN ---
  async login(dto: LoginDto) {
    const login = dto.login.trim();
    const isEmail = login.includes('@');
    const user = await this.usersRepository.findOne({
      where: isEmail ? { email: login } : { phoneNumber: login },
      select: {
        id: true,
        name: true,
        role: true,
        password: true,
        banned: true,
        isProfileComplete: true,
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.banned) {
      throw new ForbiddenException('Esta conta foi suspensa.');
    }

    return this.issueTokens(user);
  }

  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({
      where: { email },
      select: { id: true, name: true, email: true, banned: true },
    });
    if (!user || !user.email || user.banned) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const code = randomInt(100000, 1000000).toString();

    await this.usersRepository.update(user.id, {
      recoveryCode: this.hashRecoveryCode(code),
      recoveryCodeExpires: new Date(Date.now() + RECOVERY_CODE_TTL_MS),
      recoveryAttempts: 0,
    });

    try {
      await this.mailService.sendRecoveryCode(user.email, user.name, code);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar código de recuperação para o usuário ${user.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  // --- RESET DE SENHA ---
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
      select: {
        id: true,
        recoveryCode: true,
        recoveryCodeExpires: true,
        recoveryAttempts: true,
      },
    });

    if (
      !user ||
      !user.recoveryCode ||
      !user.recoveryCodeExpires ||
      user.recoveryCodeExpires < new Date() ||
      user.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS
    ) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    if (!this.isRecoveryCodeValid(dto.code, user.recoveryCode)) {
      const attempts = user.recoveryAttempts + 1;
      await this.usersRepository.update(
        user.id,
        attempts >= MAX_RECOVERY_ATTEMPTS
          ? {
              recoveryAttempts: attempts,
              recoveryCode: null,
              recoveryCodeExpires: null,
            }
          : { recoveryAttempts: attempts },
      );
      throw new BadRequestException('Código inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.update(user.id, {
      password: hashedPassword,
      recoveryCode: null,
      recoveryCodeExpires: null,
      recoveryAttempts: 0,
    });
    await this.revokeAllRefreshTokens(user.id);

    return { message: 'Senha alterada com sucesso' };
  }

  async refresh(refreshToken: string) {
    const stored = await this.refreshTokensRepository.findOne({
      where: { tokenHash: this.sha256(refreshToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada.');
    }
    if (stored.revokedAt) {
      // Reuso de um token já rotacionado indica vazamento: derruba todas as sessões.
      await this.revokeAllRefreshTokens(stored.userId);
      throw new UnauthorizedException('Sessão expirada.');
    }

    const rotation = await this.refreshTokensRepository.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!rotation.affected) throw new UnauthorizedException('Sessão expirada.');

    const user = await this.usersRepository.findOne({
      where: { id: stored.userId },
      select: {
        id: true,
        name: true,
        role: true,
        banned: true,
        isProfileComplete: true,
      },
    });
    if (!user || user.banned) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    await this.refreshTokensRepository.update(
      { tokenHash: this.sha256(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { message: 'Sessão encerrada.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findWithPassword(userId);
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    await this.usersRepository.update(userId, {
      password: await bcrypt.hash(dto.newPassword, 10),
    });
    await this.revokeAllRefreshTokens(userId);
    return this.issueTokens(user);
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.findWithPassword(userId);
    if (!(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException('Senha incorreta.');
    }

    // Posts, mensagens e transações referenciam o usuário sem cascade,
    // então a conta é anonimizada em vez de removida.
    const orphanMedia = await this.usersRepository.manager.transaction(
      async (manager) => {
        const media = await this.accountDataService.eraseUserData(
          manager,
          userId,
        );
        await manager.update(User, userId, {
          name: DELETED_ACCOUNT_NAME,
          age: null,
          birthDate: null,
          showInStorePresence: false,
          showLastSeen: false,
          nickname: null,
          email: null,
          phoneNumber: null,
          city: null,
          bio: null,
          avatarUrl: null,
          notificationToken: null,
          recoveryCode: null,
          recoveryCodeExpires: null,
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          banned: true,
        });
        await manager.delete(Friendship, [{ userId }, { friendId: userId }]);
        await manager.delete(RefreshToken, { userId });
        return media;
      },
    );
    await this.accountDataService.deleteOrphanMedia(orphanMedia);
    return { message: 'Conta excluída.' };
  }

  private async findWithPassword(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        password: true,
        isProfileComplete: true,
      },
    });
    if (!user) throw new UnauthorizedException('Sessão inválida.');
    return user;
  }

  private async revokeAllRefreshTokens(userId: string) {
    await this.refreshTokensRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private hashRecoveryCode(code: string) {
    return this.sha256(code);
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private isRecoveryCodeValid(code: string, storedHash: string) {
    const received = Buffer.from(this.hashRecoveryCode(code), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return (
      received.length === stored.length && timingSafeEqual(received, stored)
    );
  }

  private async issueTokens(
    user: Pick<User, 'id' | 'name' | 'role' | 'isProfileComplete'>,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );

    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      role: user.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      userId: user.id,
      isProfileComplete: user.isProfileComplete,
    };
  }
}
