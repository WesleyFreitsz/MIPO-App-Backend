import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';

type ProfileFields = Pick<
  User,
  'name' | 'nickname' | 'city' | 'bio' | 'avatarUrl' | 'age'
>;

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

  async findAllForAdmin(skip = 0, take = 50) {
    const users = await this.usersRepository.find({
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

  async updateNotificationToken(id: string, token: string | null) {
    await this.usersRepository.update(id, { notificationToken: token });
    this.logger.debug(`[PUSH] Token de notificação atualizado para ${id}`);
    return { message: 'Token de notificação atualizado.' };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    this.logger.debug(`[PROFILE] Iniciando updateProfile para ID ${id}`);

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
    if (dto.age != null) profileFields.age = dto.age;

    await this.usersRepository.update(id, {
      ...profileFields,
      isProfileComplete: true,
    });

    this.logger.debug(
      `[PROFILE] updateProfile concluído com sucesso para ID ${id}`,
    );
    return this.findOne(id);
  }
}
