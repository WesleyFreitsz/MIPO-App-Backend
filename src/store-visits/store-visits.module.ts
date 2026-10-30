import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { AchievementsModule } from 'src/achievements/achievements.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { StoreVisit } from './entities/store-visit.entity';
import { StoreCheckinCode } from './entities/store-checkin-code.entity';
import { StoreVisitsController } from './store-visits.controller';
import { StoreVisitsService } from './store-visits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreVisit, StoreCheckinCode, User, Friendship]),
    AchievementsModule,
    NotificationsModule,
  ],
  controllers: [StoreVisitsController],
  providers: [StoreVisitsService],
  exports: [StoreVisitsService],
})
export class StoreVisitsModule {}
