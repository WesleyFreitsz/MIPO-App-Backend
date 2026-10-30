import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import {
  AGE_VERIFICATION_SELF_DECLARED,
  LEGAL_VERSION,
  MIN_AGE,
  isAllowedAge,
} from 'src/legal/legal.constants';

type ProfileFields = Pick<
  User,
  'name' | 'nickname' | 'city' | 'bio' | 'avatarUrl'
>;

import { assertAllowedContent } from 'src/common/content-filter';

@Injectable()
export class UsersService {
  private logger = new Logger('UsersService');

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findOwnProfile(id: string) {
    const [user, legal] = await Promise.all([
      this.findOne(id),
      this.usersRepository.findOne({
        where: { id },
        select: { id: true, birthDate: true },
      }),
    ]);
    return { ...user, needsBirthDate: !legal?.birthDate };
  }

  async setBirthDate(id: string, birthDate: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: { id: true, birthDate: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.birthDate) {
      throw new BadRequestException('A data de nascimento já foi informada.');
    }
    if (!isAllowedAge(birthDate)) {
      await this.usersRepository.update(id, { banned: true });
      throw new BadRequestException(
        `O Mipo é permitido apenas para maiores de ${MIN_AGE} anos. Sua conta foi suspensa.`,
      );
    }
    await this.usersRepository.update(id, {
      birthDate: birthDate.slice(0, 10),
      ageVerificationMethod: AGE_VERIFICATION_SELF_DECLARED,
    });
    return this.findOwnProfile(id);
  }

  async acceptTerms(id: string, version: string) {
    if (version !== LEGAL_VERSION) {
      throw new BadRequestException('Versão dos termos desatualizada.');
    }
    await this.usersRepository.update(id, {
      termsVersion: LEGAL_VERSION,
      termsAcceptedAt: new Date(),
    });
    return this.findOwnProfile(id);
  }

  async findAllForAdmin(skip = 0, take = 50, search?: string) {
    const term = search?.trim();
    const users = await this.usersRepository.find({
      where: term
        ? [{ name: ILike(`%${term}%`) }, { nickname: ILike(`%${term}%`) }]
        : undefined,
      skip,
      take,
      order: { name: 'ASC' },
      // Relações adicionadas aqui para o AdminAchievementsScreen funcionar corretamente:
      relations: ['achievements', 'achievements.achievement'],
    });
    return { data: users };
  }

  async addCoins(id: string, amount: number) {
    await this.findOne(id);
    await this.usersRepository.increment({ id }, 'coins', amount);
    return this.findOne(id);
  }

  async setBanned(adminId: string, id: string, banned: boolean) {
    if (adminId === id) {
      throw new BadRequestException('Você não pode banir a própria conta.');
    }
    await this.findOne(id);
    await this.usersRepository.update(id, { banned });
    return this.findOne(id);
  }

  async setRole(adminId: string, id: string, role: UserRole) {
    if (adminId === id) {
      throw new BadRequestException('Você não pode alterar o próprio papel.');
    }
    await this.findOne(id);
    await this.usersRepository.update(id, { role });
    return this.findOne(id);
  }

  async updateNotificationToken(id: string, token: string | null) {
    await this.usersRepository.update(id, { notificationToken: token });
    this.logger.debug(`[PUSH] Token de notificação atualizado para ${id}`);
    return { message: 'Token de notificação atualizado.' };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    this.logger.debug(`[PROFILE] Iniciando updateProfile para ID ${id}`);
    assertAllowedContent(dto.name, dto.nickname, dto.bio, dto.city);

    await this.findOne(id);

    // Verifica nickname único
    if (dto.nickname) {
      const nickExists = await this.usersRepository.findOne({
        where: { nickname: dto.nickname },
        select: { id: true },
      });
      if (nickExists && nickExists.id !== id) {
        throw new ConflictException('Este nickname já está em uso.');
      }
    }

    const profileFields: Partial<ProfileFields> = {};
    if (dto.name != null) profileFields.name = dto.name;
    if (dto.nickname != null) profileFields.nickname = dto.nickname;
    if (dto.city != null) profileFields.city = dto.city;
    if (dto.bio != null) profileFields.bio = dto.bio;
    if (dto.avatarUrl != null) profileFields.avatarUrl = dto.avatarUrl;

    await this.usersRepository.update(id, {
      ...profileFields,
      ...(Object.keys(profileFields).length > 0 && { isProfileComplete: true }),
      ...(dto.showInStorePresence != null && {
        showInStorePresence: dto.showInStorePresence,
      }),
      ...(dto.showLastSeen != null && { showLastSeen: dto.showLastSeen }),
    });

    this.logger.debug(
      `[PROFILE] updateProfile concluído com sucesso para ID ${id}`,
    );
    return this.findOne(id);
  }
}
