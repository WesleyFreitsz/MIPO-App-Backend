import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsService } from './reports.service';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { ChatMessage } from '../chats/entities/chat-message.entity';
import { ChatMember } from '../chats/entities/chat-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Post, User, ChatMessage, ChatMember]),
    NotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
