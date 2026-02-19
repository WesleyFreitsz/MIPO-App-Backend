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
    this.logger.debug(
      `[UPDATE] Dados recebidos para ID ${id}: ${JSON.stringify(data)}`,
    );

    // Função helper para limpar dados (melhora tipagem)
    const cleanData = this.cleanPartialData(data);

    this.logger.debug(
      `[UPDATE] cleanData após filtro: ${JSON.stringify(cleanData)}`,
    );

    if (Object.keys(cleanData).length === 0) {
      this.logger.warn(
        `[UPDATE] Tentativa de update VAZIO ignorada para usuário ${id}`,
      );
      return this.findOne(id);
    }

    try {
      await this.usersRepository.update(id, cleanData);
      this.logger.debug(`[UPDATE] Sucesso ao atualizar usuário ${id}`);
    } catch (error) {
      this.logger.error(
        `[UPDATE] Erro ao atualizar usuário ${id}: ${error.message}`,
      );
      this.logger.error(
        `[UPDATE] cleanData que causou erro: ${JSON.stringify(cleanData)}`,
      );
      throw error;
    }

    return this.findOne(id);
  }

  private cleanPartialData(data: Partial<User>): Partial<User> {
    return Object.entries(data).reduce<Partial<User>>((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        // @ts-expect-error Suppress se TS ainda reclamar de mismatch (remova após teste)
        acc[key as keyof User] = value;
      }
      return acc;
    }, {});
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    this.logger.debug(
      `[PROFILE] Iniciando updateProfile para ID ${id} | DTO: ${JSON.stringify(dto)}`,
    );

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

    const updateData = {
      ...dto,
      isProfileComplete: true,
    };

    this.logger.debug(
      `[PROFILE] Dados finais que serão enviados para update: ${JSON.stringify(updateData)}`,
    );

    // Chama o método blindado
    const result = await this.update(id, updateData);

    this.logger.debug(
      `[PROFILE] updateProfile concluído com sucesso para ID ${id}`,
    );
    return result;
  }
}
