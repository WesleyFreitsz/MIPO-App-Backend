import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { SalinhaReservation } from './entities/salinha-reservation.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { RoomsSeed } from './rooms.seed';
import { ChatsModule } from '../chats/chats.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, SalinhaReservation]),
    ChatsModule,
    UsersModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsSeed],
  exports: [RoomsService, RoomsSeed],
})
export class RoomsModule {}
