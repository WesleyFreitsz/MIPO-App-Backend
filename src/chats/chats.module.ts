import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { Chat } from './entities/chat.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { Friendship } from '../friends/entities/friendship.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, ChatMember, ChatMessage, User, Friendship]),
    AuthModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService],
})
export class ChatsModule {}
