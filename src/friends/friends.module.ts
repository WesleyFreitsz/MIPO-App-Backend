import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { Friendship } from './entities/friendship.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AchievementsModule } from 'src/achievements/achievements.module';
import { Achievement } from 'src/achievements/entities/achievement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, User, Achievement]),
    NotificationsModule,
    AchievementsModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
