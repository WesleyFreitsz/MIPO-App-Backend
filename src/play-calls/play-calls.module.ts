import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/games/entities/game.entity';
import { GameUserMark } from 'src/games/entities/game-user-mark.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';
import { StoreVisitsModule } from 'src/store-visits/store-visits.module';
import { ChatsModule } from 'src/chats/chats.module';
import { PlayCall } from './entities/play-call.entity';
import { PlayCallMember } from './entities/play-call-member.entity';
import { PlayCallsController } from './play-calls.controller';
import { PlayCallsService } from './play-calls.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlayCall,
      PlayCallMember,
      Game,
      GameUserMark,
      Friendship,
      StoreVisit,
    ]),
    StoreVisitsModule,
    ChatsModule,
  ],
  controllers: [PlayCallsController],
  providers: [PlayCallsService],
})
export class PlayCallsModule {}
