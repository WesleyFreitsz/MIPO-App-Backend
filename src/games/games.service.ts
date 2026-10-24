import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { CreateGameDto, GamesQueryDto, UpdateGameDto } from './dto/game.dto';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

  async findAll(query: GamesQueryDto) {
    const { search, category, players, isFeatured, active } = query;

    const qb = this.gamesRepository.createQueryBuilder('game');

    // Se passar active=all, não filtra por status (traz ativos e inativos).
    // Se não passar nada, traz só os ativos (padrão para os usuários).
    if (active === 'all') {
      qb.where('1=1'); // Truque para o TypeORM aceitar os andWhere seguintes
    } else if (active !== undefined) {
      qb.where('game.active = :active', { active: active === 'true' });
    } else {
      qb.where('game.active = :active', { active: true });
    }

    if (search) {
      qb.andWhere('game.name ILIKE :search', { search: `%${search}%` });
    }

    if (category) {
      qb.andWhere('game.category ILIKE :category', {
        category: `%${category}%`,
      });
    }

    const numPlayers = players ? parseInt(players, 10) : NaN;
    if (!Number.isNaN(numPlayers)) {
      qb.andWhere(
        'game.minPlayers <= :numPlayers AND game.maxPlayers >= :numPlayers',
        {
          numPlayers,
        },
      );
    }

    if (isFeatured !== undefined) {
      qb.andWhere('game.isFeatured = :isFeatured', {
        isFeatured: isFeatured === 'true',
      });
    }

    qb.orderBy('game.createdAt', 'DESC');

    return qb.getMany();
  }

  async findOne(id: string) {
    const game = await this.gamesRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Jogo não encontrado.');
    return game;
  }

  async create(dto: CreateGameDto) {
    this.assertPlayersRange(dto.minPlayers, dto.maxPlayers);
    const game = this.gamesRepository.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      minPlayers: dto.minPlayers,
      maxPlayers: dto.maxPlayers,
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      active: true,
      isFeatured: dto.isFeatured || false,
    });
    return this.gamesRepository.save(game);
  }

  async update(id: string, dto: UpdateGameDto) {
    const game = await this.gamesRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Jogo não encontrado.');

    if (dto.name !== undefined) game.name = dto.name;
    if (dto.description !== undefined) game.description = dto.description;
    if (dto.category !== undefined) game.category = dto.category;
    if (dto.minPlayers !== undefined) game.minPlayers = dto.minPlayers;
    if (dto.maxPlayers !== undefined) game.maxPlayers = dto.maxPlayers;
    if (dto.imageUrl !== undefined) game.imageUrl = dto.imageUrl;
    if (dto.videoUrl !== undefined) game.videoUrl = dto.videoUrl;
    if (dto.isFeatured !== undefined) game.isFeatured = dto.isFeatured;
    if (dto.active !== undefined) game.active = dto.active;

    this.assertPlayersRange(game.minPlayers, game.maxPlayers);
    return this.gamesRepository.save(game);
  }

  private assertPlayersRange(minPlayers: number, maxPlayers: number) {
    if (minPlayers > maxPlayers) {
      throw new BadRequestException(
        'O mínimo de jogadores não pode ser maior que o máximo.',
      );
    }
  }

  async toggleFeatured(id: string) {
    const game = await this.gamesRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Jogo não encontrado.');
    game.isFeatured = !game.isFeatured;
    return this.gamesRepository.save(game);
  }

  async remove(id: string) {
    const game = await this.gamesRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Jogo não encontrado.');
    await this.gamesRepository.remove(game);
    return { message: 'Jogo excluído.' };
  }
}
