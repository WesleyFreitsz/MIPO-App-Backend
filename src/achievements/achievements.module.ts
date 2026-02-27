import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './entities/achievement.entity';
import { Rarity } from './entities/rarity.entity';
import { User } from 'src/users/entities/user.entity';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { UserAchievement } from 'src/users/entities/user-achievement.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Achievement, Rarity, UserAchievement, User]),
    NotificationsModule, // <-- ADICIONE AQUI
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService], // Exportamos para que Events e Friends possam usar
})
export class AchievementsModule {}
