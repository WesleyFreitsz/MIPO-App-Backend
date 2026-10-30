import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/games/entities/game.entity';
import { GameUserMark } from 'src/games/entities/game-user-mark.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { GamePlay } from './entities/game-play.entity';
import { GamePlayPlayer } from './entities/game-play-player.entity';
import { GamePlaysController } from './game-plays.controller';
import { GamePlaysService } from './game-plays.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GamePlay,
      GamePlayPlayer,
      Game,
      GameUserMark,
      Friendship,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [GamePlaysController],
  providers: [GamePlaysService],
  exports: [GamePlaysService],
})
export class GamePlaysModule {}
