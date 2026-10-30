import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/games/entities/game.entity';
import { User } from 'src/users/entities/user.entity';
import { MonthlyGame } from './entities/monthly-game.entity';
import { MonthlyGameScore } from './entities/monthly-game-score.entity';
import { MonthlyGamesController } from './monthly-games.controller';
import { MonthlyGamesService } from './monthly-games.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyGame, MonthlyGameScore, Game, User]),
  ],
  controllers: [MonthlyGamesController],
  providers: [MonthlyGamesService],
})
export class MonthlyGamesModule {}
