import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notifications } from './entities/notifications.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsGateway } from './notifications.gateway';

@Global() // Deixa global para o Posts e Reports Service usarem sem precisar importar toda hora
@Module({
  imports: [TypeOrmModule.forFeature([Notifications, User])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
