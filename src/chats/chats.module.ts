import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { Chat } from './entities/chat.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { User } from '../users/entities/user.entity';
import { Friendship } from '../friends/entities/friendship.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Chat,
      ChatMember,
      ChatMessage,
      ChatMessageReaction,
      User,
      Friendship,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService],
})
export class ChatsModule {}
