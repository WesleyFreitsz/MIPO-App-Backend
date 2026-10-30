import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationPreference } from './notifications/entities/notification-preference.entity';
import { ScheduledNotification } from './notifications/entities/scheduled-notification.entity';

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
import { Transaction } from './finance/entities/transaction.entity';
import { ReportsModule } from './reports/reports.module';
import { Report } from './reports/entities/report.entity';
import { Upload } from './uploads/entities/upload.entity';
import { Rarity } from './achievements/entities/rarity.entity';
import { UploadsModule } from './uploads/uploads.module';
import { UserAchievement } from './users/entities/user-achievement.entity';
import { MonthlyGamesModule } from './monthly-games/monthly-games.module';
import { MonthlyGame } from './monthly-games/entities/monthly-game.entity';
import { MonthlyGameScore } from './monthly-games/entities/monthly-game-score.entity';
import { GameUserMark } from './games/entities/game-user-mark.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { RewardRedemption } from './rewards/entities/reward-redemption.entity';
import { ChatMessageReaction } from './chats/entities/chat-message-reaction.entity';
import { StoreVisitsModule } from './store-visits/store-visits.module';
import { StoreVisit } from './store-visits/entities/store-visit.entity';
import { StoreCheckinCode } from './store-visits/entities/store-checkin-code.entity';
import { OrdersModule } from './orders/orders.module';
import { MenuItem } from './orders/entities/menu-item.entity';
import { OrderTab } from './orders/entities/order-tab.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { GamePlaysModule } from './game-plays/game-plays.module';
import { GamePlay } from './game-plays/entities/game-play.entity';
import { GamePlayPlayer } from './game-plays/entities/game-play-player.entity';
import { PlayCallsModule } from './play-calls/play-calls.module';
import { PlayCall } from './play-calls/entities/play-call.entity';
import { PlayCallMember } from './play-calls/entities/play-call-member.entity';
import { ReviewsModule } from './reviews/reviews.module';
import { VisitReview } from './reviews/entities/visit-review.entity';
import { OrderReview } from './reviews/entities/order-review.entity';
import { LegalModule } from './legal/legal.module';
import { CommonSecurityModule } from './common/common-security.module';
import { RetentionModule } from './retention/retention.module';
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
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
            Transaction,
            Report,
            Upload,
            MonthlyGame,
            MonthlyGameScore,
            GameUserMark,
            NotificationPreference,
            ScheduledNotification,
            RefreshToken,
            RewardRedemption,
            ChatMessageReaction,
            StoreVisit,
            StoreCheckinCode,
            MenuItem,
            OrderTab,
            Order,
            OrderItem,
            GamePlay,
            GamePlayPlayer,
            PlayCall,
            PlayCallMember,
            VisitReview,
            OrderReview,
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
    FinanceModule,
    ReportsModule,
    UploadsModule,
    MonthlyGamesModule,
    StoreVisitsModule,
    OrdersModule,
    GamePlaysModule,
    PlayCallsModule,
    ReviewsModule,
    LegalModule,
    CommonSecurityModule,
    RetentionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
