import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';

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
    const { password, ...result } = user;
    return result;
  }

  /**
   * Atualização segura e blindada contra UpdateValuesMissingError
   */
  async update(id: string, data: Partial<User>) {
    // Função helper para limpar dados (melhora tipagem)
    const cleanData = this.cleanPartialData(data);

    if (Object.keys(cleanData).length === 0) {
      this.logger.warn(
        `[UPDATE] Tentativa de update VAZIO ignorada para usuário ${id}`,
      );
      return this.findOne(id);
    }

    try {
      await this.usersRepository.update(id, cleanData);
      this.logger.debug(`[UPDATE] Sucesso ao atualizar usuário ${id}`);
    } catch (error: any) {
      this.logger.error(
        `[UPDATE] Erro ao atualizar usuário ${id}: ${error.message}`,
      );
      throw error;
    }

    return this.findOne(id);
  }

  private cleanPartialData(data: Partial<User>): Partial<User> {
    return Object.entries(data).reduce<Partial<User>>((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        // @ts-expect-error Suppress se TS ainda reclamar de mismatch
        acc[key as keyof User] = value;
      }
      return acc;
    }, {});
  }

  async findAllForAdmin(skip = 0, take = 50) {
    const users = await this.usersRepository.find({
      skip,
      take,
      order: { name: 'ASC' },
      // Relações adicionadas aqui para o AdminAchievementsScreen funcionar corretamente:
      relations: ['achievements', 'achievements.achievement'],
    });
    const result = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });
    return { data: result };
  }

  async addCoins(id: string, amount: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    user.coins = (user.coins || 0) + amount;
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async setBanned(id: string, banned: boolean) {
    return this.update(id, { banned });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    this.logger.debug(`[PROFILE] Iniciando updateProfile para ID ${id}`);

    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Verifica nickname único
    if (dto.nickname) {
      const nickExists = await this.usersRepository.findOne({
        where: { nickname: dto.nickname },
      });
      if (nickExists && nickExists.id !== id) {
        throw new ConflictException('Este nickname já está em uso.');
      }
    }

    // Se o dto.avatarUrl contiver a string Base64, ela substituirá a antiga na mesma coluna.
    const updateData = {
      ...dto,
      isProfileComplete: true,
    };

    const result = await this.update(id, updateData);

    this.logger.debug(
      `[PROFILE] updateProfile concluído com sucesso para ID ${id}`,
    );
    return result;
  }
}
