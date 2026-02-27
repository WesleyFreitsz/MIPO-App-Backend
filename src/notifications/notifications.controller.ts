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
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt')) // Protege todas as rotas com JWT
export class NotificationsController {
  constructor(private readonly notifService: NotificationsService) {}

  // Listar notificações do usuário logado
  @Get()
  async getMyNotifications(
    @Request() req,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    // Converte para número e passa para o service. Se não vier, usa os padrões 0 e 20.
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;

    return this.notifService.getUserNotifications(
      req.user.userId,
      skipNum,
      takeNum,
    );
  }

  // Marcar uma notificação como lida
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    // Nota: Você precisará adicionar o método markAsRead no Service,
    // ou usar um update simples aqui. Vou deixar a sugestão:
    // return this.notifService.markAsRead(id);
    return { message: 'Notificação lida' };
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req) {
    return this.notifService.markAllAsRead(req.user.userId);
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
