import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

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
import { SalinhaReservation } from './rooms/entities/salinha-reservation.entity';
import { Transaction } from './finance/entities/transaction.entity';
import { ReportsModule } from './reports/reports.module';
import { Report } from './reports/entities/report.entity';
import { Upload } from './uploads/entities/upload.entity';
import { Rarity } from './achievements/entities/rarity.entity';
import { UploadsModule } from './uploads/uploads.module';
import { UserAchievement } from './users/entities/user-achievement.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

function resolveDatabaseSsl(mode: string | undefined, ca: string | undefined) {
  if (mode === 'false') return false;
  if (ca) return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  if (mode === 'verify') return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const sslCa = configService.get<string>('DB_SSL_CA');
        return {
          type: 'postgres' as const,
          url: configService.getOrThrow<string>('DIRECT_URL'),
          entities: [
            User,
            Event,
            Notifications,
            Friendship,
            Post,
            PostComment,
            PostLike,
            Chat,
            Rarity, // <--- ADICIONADO
            UserAchievement,
            ChatMember,
            ChatMessage,
            Achievement,
            Reward,
            Game,
            Room,
            SalinhaReservation,
            Transaction,
            Report,
            Upload,
          ],
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          ssl: resolveDatabaseSsl(configService.get<string>('DB_SSL'), sslCa),
          extra: {
            max: 10,
          },
        };
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
    ReportsModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
