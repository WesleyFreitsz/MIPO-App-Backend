import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt')) // Protege todas as rotas com JWT
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  // Listar notificações do usuário logado
  @Get()
  async getMyNotifications(@Request() req) {
    return this.notifService.getUserNotifications(req.user.userId);
  }

  // Marcar uma notificação como lida
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    // Nota: Você precisará adicionar o método markAsRead no Service,
    // ou usar um update simples aqui. Vou deixar a sugestão:
    // return this.notifService.markAsRead(id);
    return { message: 'Notificação lida' };
  }

  // (ADMIN) Enviar notificação para todos manualmente
  @Post('admin-broadcast')
  async manualBroadcast(
    @Request() req,
    @Body() body: { title: string; message: string; icon?: string },
  ) {
    if (req.user.role !== 'ADMIN') {
      // Verifica no Token se é Admin
      throw new ForbiddenException(
        'Apenas administradores podem enviar alertas globais.',
      );
    }

    return this.notifService.broadcast(body.title, body.message, body.icon);
  }
}
