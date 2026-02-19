import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from 'src/mail/mail.service'; // Importação do novo serviço

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private mailService: MailService, // Injetando o serviço de e-mail
  ) {}

  // --- REGISTRO ---
  async register(dto: RegisterDto) {
    const isEmail = dto.login.includes('@');
    const existingUser = await this.usersRepository.findOne({
      where: isEmail ? { email: dto.login } : { phoneNumber: dto.login },
    });

    if (existingUser) throw new ConflictException('Usuário já existe.');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const newUser = this.usersRepository.create({
      name: dto.name,
      password: hashedPassword,
      age: dto.age,
      email: isEmail ? dto.login : null,
      phoneNumber: !isEmail ? dto.login : null,
    });

    await this.usersRepository.save(newUser);
    return this.generateToken(newUser);
  }

  // --- LOGIN ---
  async login(dto: LoginDto) {
    const isEmail = dto.login.includes('@');
    const user = await this.usersRepository.findOne({
      where: isEmail ? { email: dto.login } : { phoneNumber: dto.login },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateToken(user);
  }

  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await this.usersRepository.update(user.id, {
      recoveryCode: code,
      recoveryCodeExpires: new Date(Date.now() + 2 * 60 * 1000),
    });

    await this.mailService.sendRecoveryCode(user.email!, user.name, code);

    return { message: 'Código enviado com sucesso!' };
  }

  // --- RESET DE SENHA ---
  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.usersRepository.findOne({
      where: { email, recoveryCode: code },
    });

    if (
      !user ||
      !user.recoveryCodeExpires ||
      user.recoveryCodeExpires < new Date()
    ) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(user.id, {
      password: hashedPassword,
      recoveryCode: null,
      recoveryCodeExpires: null,
    });

    return { message: 'Senha alterada com sucesso' };
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, name: user.name, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      userId: user.id,
      isProfileComplete: user.isProfileComplete,
    };
  }
}
