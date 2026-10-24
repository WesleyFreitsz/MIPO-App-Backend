import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomType, ReservationStatus } from './entities/room.entity';
import { todayInRoomsTimeZone } from './room-time.util';

@Injectable()
export class RoomsSeed {
  private readonly logger = new Logger(RoomsSeed.name);

  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  async seed() {
    const fixedRooms = [
      {
        id: 'a1234567-b890-c123-d456-e78901234567',
        type: RoomType.SALINHA,
      },
      {
        id: 'b1234567-c890-d123-e456-f78901234567',
        type: RoomType.SALAO_INTERNO,
      },
      {
        id: 'c1234567-d890-e123-f456-a78901234567',
        type: RoomType.SALAO_EXTERNO,
      },
    ];

    for (const roomData of fixedRooms) {
      // Procurar por ID específico
      const existingRoom = await this.roomsRepository.findOne({
        where: { id: roomData.id },
      });

      if (!existingRoom) {
        // Procurar por tipo (salas antigas)
        const oldRoom = await this.roomsRepository.findOne({
          where: { type: roomData.type },
        });

        if (oldRoom) {
          // Deletar sala antiga para evitar conflito
          this.logger.log(
            `Deletando sala antiga (${oldRoom.id}) do tipo ${roomData.type}`,
          );
          await this.roomsRepository.remove(oldRoom);
        }

        const today = todayInRoomsTimeZone();
        const room = this.roomsRepository.create({
          id: roomData.id,
          type: roomData.type,
          organizerId: null,
          date: today,
          startTime: '00:00',
          endTime: '23:59',
          participants: [],
          reservationStatus: ReservationStatus.APPROVED,
          chatId: null,
        });
        await this.roomsRepository.save(room);
        this.logger.log(`Sala ${roomData.type} criada (ID: ${roomData.id})`);
      } else {
        // Atualizar data diariamente se existir com ID correto
        const today = todayInRoomsTimeZone();
        let changed = false;
        if (existingRoom.date !== today) {
          existingRoom.date = today;
          existingRoom.participants = [];
          changed = true;
        }
        if (existingRoom.reservationStatus !== ReservationStatus.APPROVED) {
          existingRoom.reservationStatus = ReservationStatus.APPROVED;
          changed = true;
        }
        if (changed) {
          await this.roomsRepository.save(existingRoom);
          this.logger.log(`Sala ${roomData.type} atualizada para hoje`);
        }
      }
    }
  }
}
