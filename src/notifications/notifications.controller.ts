import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UserRole } from 'src/users/entities/user.entity';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard) // Protege todas as rotas com JWT
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  // Listar notificações do usuário logado
  @Get()
  async getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.notifService.getUserNotifications(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifService.markAllAsRead(user.userId);
  }

  // Marcar uma notificação como lida
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifService.markAsRead(id, user.userId);
  }

  // (ADMIN) Enviar notificação para todos manualmente
  @Post('admin-broadcast')
  @Roles(UserRole.ADMIN)
  async manualBroadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notifService.broadcast(dto.title, dto.message, dto.icon);
  }
}
