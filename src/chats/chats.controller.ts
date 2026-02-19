import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddMembersDto } from './dto/add-members.dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  /**
   * Criar novo chat em grupo
   * POST /chats/group
   */
  @Post('group')
  async createGroupChat(@Request() req, @Body() dto: CreateChatDto) {
    return this.chatsService.createChat(req.user.userId, dto);
  }

  /**
   * Criar chat privado com outro usuário
   * POST /chats/private/:userId
   */
  @Post('private/:userId')
  async createPrivateChat(
    @Request() req,
    @Param('userId') targetUserId: string,
  ) {
    return this.chatsService.createPrivateChat(req.user.userId, targetUserId);
  }

  /**
   * Listar todos os chats do usuário
   * GET /chats
   */
  @Get()
  async getUserChats(
    @Request() req,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.chatsService.getUserChats(req.user.userId, skip, take);
  }

  /**
   * Obter detalhes de um chat
   * GET /chats/:id
   */
  @Get(':id')
  async getChatDetails(@Param('id') chatId: string) {
    return this.chatsService.getChatDetails(chatId);
  }

  /**
   * Enviar mensagem
   * POST /chats/:id/messages
   */
  @Post(':id/messages')
  async sendMessage(
    @Request() req,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatsService.sendMessage(chatId, req.user.userId, dto);
  }

  /**
   * Listar mensagens de um chat
   * GET /chats/:id/messages
   */
  @Get(':id/messages')
  async getMessages(
    @Request() req,
    @Param('id') chatId: string,
    @Query('skip') skip = 0,
    @Query('take') take = 50,
  ) {
    return this.chatsService.getMessages(chatId, skip, take);
  }

  /**
   * Marcar mensagens como lidas
   * POST /chats/:id/mark-as-read
   */
  @Post(':id/mark-as-read')
  async markMessagesAsRead(@Request() req, @Param('id') chatId: string) {
    return this.chatsService.markMessagesAsRead(chatId, req.user.userId);
  }

  /**
   * Adicionar membros ao chat
   * POST /chats/:id/members
   */
  @Post(':id/members')
  async addMembers(
    @Request() req,
    @Param('id') chatId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.chatsService.addMembers(chatId, req.user.userId, dto);
  }

  /**
   * Remover membro do chat
   * DELETE /chats/:id/members/:memberId
   */
  @Delete(':id/members/:memberId')
  async removeMember(
    @Request() req,
    @Param('id') chatId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.chatsService.removeMember(chatId, req.user.userId, memberId);
  }

  /**
   * Sair de um chat
   * POST /chats/:id/leave
   */
  @Post(':id/leave')
  async leaveChat(@Request() req, @Param('id') chatId: string) {
    return this.chatsService.leaveChat(chatId, req.user.userId);
  }

  /**
   * Deletar chat
   * DELETE /chats/:id
   */
  @Delete(':id')
  async deleteChat(@Request() req, @Param('id') chatId: string) {
    return this.chatsService.deleteChat(chatId, req.user.userId);
  }
}
