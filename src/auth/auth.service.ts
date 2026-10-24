import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { User } from 'src/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from 'src/mail/mail.service'; // Importação do novo serviço
import { JwtPayload } from './authenticated-user.interface';

const RECOVERY_CODE_TTL_MS = 2 * 60 * 1000;
const MAX_RECOVERY_ATTEMPTS = 5;
const FORGOT_PASSWORD_MESSAGE =
  'Se o e-mail estiver cadastrado, você receberá um código de recuperação.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService, // Injetando o serviço de e-mail
  ) {}

  // --- REGISTRO ---
  async register(dto: RegisterDto) {
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
      age: dto.age,
      email: isEmail ? login : null,
      phoneNumber: !isEmail ? login : null,
    });

    const savedUser = await this.usersRepository.save(newUser);
    return this.generateToken(savedUser);
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

    return this.generateToken(user);
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

    return { message: 'Senha alterada com sucesso' };
  }

  private hashRecoveryCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private isRecoveryCodeValid(code: string, storedHash: string) {
    const received = Buffer.from(this.hashRecoveryCode(code), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return (
      received.length === stored.length && timingSafeEqual(received, stored)
    );
  }

  private generateToken(
    user: Pick<User, 'id' | 'name' | 'role' | 'isProfileComplete'>,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      name: user.name,
      role: user.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
      userId: user.id,
      isProfileComplete: user.isProfileComplete,
    };
  }
}
