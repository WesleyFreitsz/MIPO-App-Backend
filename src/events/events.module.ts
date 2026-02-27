import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { User } from 'src/users/entities/user.entity'; // <--- Importe o User
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ChatMember } from 'src/chats/entities/chat-member.entity';
import { Chat } from 'src/chats/entities/chat.entity';
import { Achievement } from 'src/achievements/entities/achievement.entity';
import { AchievementsModule } from 'src/achievements/achievements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User, Chat, ChatMember, Achievement]),
    NotificationsModule,
    AchievementsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
