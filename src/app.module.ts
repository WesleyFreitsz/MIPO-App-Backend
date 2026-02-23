import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { User } from './users/entities/user.entity';
// CORREÇÃO 1: Importar o Event explicitamente
import { Event } from './events/entities/event.entity';
// CORREÇÃO 2: Importar Notification (singular, conforme criado antes)

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';
import { Notifications } from './notifications/entities/notifications.entity';
import { FriendsModule } from './friends/friends.module';
import { PostsModule } from './posts/posts.module';
import { ChatsModule } from './chats/chats.module';
import { AchievementsModule } from './achievements/achievements.module';
import { RewardsModule } from './rewards/rewards.module';
import { GamesModule } from './games/games.module';
import { RoomsModule } from './rooms/rooms.module';
import { FinanceModule } from './finance/finance.module';
import { Friendship } from './friends/entities/friendship.entity';
import { Post } from './posts/entities/post.entity';
import { PostComment } from './posts/entities/post-comment.entity';
import { PostLike } from './posts/entities/post-like.entity';
import { Chat } from './chats/entities/chat.entity';
import { ChatMember } from './chats/entities/chat-member.entity';
import { ChatMessage } from './chats/entities/chat-message.entity';
import { Achievement } from './achievements/entities/achievement.entity';
import { Reward } from './rewards/entities/reward.entity';
import { Game } from './games/entities/game.entity';
import { Room } from './rooms/entities/room.entity';
import { Transaction } from './finance/entities/transaction.entity';
import { UploadsController } from './uploads/uploads.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DIRECT_URL,
      // CORREÇÃO 3: Passar as classes importadas aqui
      entities: [
        User,
        Event,
        Notifications,
        Friendship,
        Post,
        PostComment,
        PostLike,
        Chat,
        ChatMember,
        ChatMessage,
        Achievement,
        Reward,
        Game,
        Room,
        Transaction,
      ],
      synchronize: true,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },
      defaults: {
        from: '"Mipo Board Games" <noreply@mipo.com>',
      },
      template: {
        dir: join(__dirname, 'mail/templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    EventsModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    PostsModule,
    ChatsModule,
    AchievementsModule,
    RewardsModule,
    GamesModule,
    RoomsModule,
    FinanceModule,
  ],
  controllers: [UploadsController],
})
export class AppModule {}
