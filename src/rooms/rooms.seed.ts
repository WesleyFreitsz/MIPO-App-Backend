import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomType, ReservationStatus } from './entities/room.entity';

@Injectable()
export class RoomsSeed {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  async seed() {
    console.log('[ROOMS SEED] Iniciando seed das salas fixas...');
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
          console.log(
            `🗑️ Deletando sala antiga (${oldRoom.id}) do tipo ${roomData.type}`,
          );
          await this.roomsRepository.remove(oldRoom);
        }

        const today = new Date().toISOString().split('T')[0];
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
        console.log(
          `✅ Sala ${roomData.type} criada com sucesso (ID: ${roomData.id})`,
        );
      } else {
        // Atualizar data diariamente se existir com ID correto
        const today = new Date().toISOString().split('T')[0];
        if (existingRoom.date !== today) {
          existingRoom.date = today;
          existingRoom.participants = [];
          await this.roomsRepository.save(existingRoom);
          console.log(`♻️ Sala ${roomData.type} resetada para hoje!`);
        } else {
          console.log(
            `ℹ️ Sala ${roomData.type} já existe e está atualizada (ID: ${roomData.id})`,
          );
        }
      }
    }
    console.log('[ROOMS SEED] ✅ Seed concluído!');
  }
}
