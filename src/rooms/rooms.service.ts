import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { ChatsService } from '../chats/chats.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    private chatsService: ChatsService,
  ) {}

  private ensureParticipantIds(room: Room): string[] {
    if (!room.participantIds) return room.organizerId ? [room.organizerId] : [];
    if (Array.isArray(room.participantIds)) return room.participantIds.filter(Boolean);
    const s = String(room.participantIds).trim();
    return s ? s.split(',').filter(Boolean) : room.organizerId ? [room.organizerId] : [];
  }

  async findAll(skip = 0, take = 20) {
    const rooms = await this.roomsRepository.find({
      relations: ['organizer'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return rooms.map((r) => ({
      id: r.id,
      game: r.game,
      date: r.date,
      time: r.time,
      maxParticipants: r.maxParticipants,
      isPublic: r.isPublic,
      description: r.description,
      chatId: r.chatId,
      organizer: r.organizer ? { id: r.organizer.id, name: r.organizer.name } : null,
      participants: this.ensureParticipantIds(r).length,
    }));
  }

  async create(
    userId: string,
    dto: {
      game: string;
      date: string;
      time: string;
      maxParticipants?: number;
      isPublic?: boolean;
      description?: string;
    },
  ) {
    const participantIds = [userId];
    const room = this.roomsRepository.create({
      ...dto,
      organizerId: userId,
      participantIds,
      maxParticipants: dto.maxParticipants ?? 4,
      isPublic: dto.isPublic ?? true,
    });
    return this.roomsRepository.save(room);
  }

  async join(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Sala não encontrada.');

    const ids = this.ensureParticipantIds(room);
    if (ids.includes(userId)) {
      return { room, chatId: room.chatId, alreadyMember: true };
    }
    if (ids.length >= room.maxParticipants) {
      throw new BadRequestException('Sala cheia.');
    }

    ids.push(userId);
    room.participantIds = ids;

    if (!room.chatId) {
      const chat = await this.chatsService.createChat(
        room.organizerId,
        { name: `Sala ${room.game}` },
      );
      room.chatId = (chat as any).id;
    }
    if (room.chatId) {
      await this.chatsService.addMembers(room.chatId, room.organizerId, {
        memberIds: [userId],
      });
    }

    await this.roomsRepository.save(room);
    return { room, chatId: room.chatId };
  }

  async remove(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.organizerId !== userId) {
      throw new ForbiddenException('Apenas o organizador pode excluir a sala.');
    }
    await this.roomsRepository.remove(room);
    return { message: 'Sala excluída.' };
  }
}
