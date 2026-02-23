import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

  async findAll(query: any) {
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

    if (players) {
      const numPlayers = parseInt(players, 10);
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

  async create(dto: {
    name: string;
    description?: string;
    category: string[];
    minPlayers: number;
    maxPlayers: number;
    imageUrl: string;
    videoUrl?: string;
    isFeatured?: boolean;
  }) {
    const game = this.gamesRepository.create({
      ...dto,
      active: true,
      isFeatured: dto.isFeatured || false,
    });
    return this.gamesRepository.save(game);
  }

  async update(id: string, dto: Partial<Game>) {
    const game = await this.gamesRepository.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Jogo não encontrado.');
    Object.assign(game, dto);
    return this.gamesRepository.save(game);
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
