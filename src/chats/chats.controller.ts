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
  Patch,
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
  @Patch(':id')
  async updateChatDetails(
    @Request() req,
    @Param('id') chatId: string,
    @Body() dto: { name?: string; description?: string; imageUrl?: string },
  ) {
    return this.chatsService.updateChatDetails(chatId, req.user.userId, dto);
  }

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

  @Patch('messages/:id')
  async editMessage(
    @Param('id') messageId: string,
    @Body('content') content: string,
  ) {
    return this.chatsService.editMessage(messageId, content);
  }

  /**
   * Apagar mensagem
   * IMPORTANTE: Deve ficar ANTES de @Delete(':id')
   * DELETE /chats/messages/:id
   */
  @Delete('messages/:id')
  async deleteMessage(@Param('id') messageId: string) {
    return this.chatsService.deleteMessage(messageId);
  }

  /**
   * Atualizar cargo do membro (Tornar Admin)
   * PATCH /chats/:id/members/:userId/role
   */
  /**
   * Promover membro a Admin
   * PATCH /chats/:id/members/:memberId/promote
   */
  @Patch(':id/members/:memberId/promote')
  async promoteToAdmin(
    @Request() req,
    @Param('id') chatId: string,
    @Param('memberId') targetUserId: string,
  ) {
    return this.chatsService.promoteToAdmin(
      chatId,
      req.user.userId,
      targetUserId,
    );
  }

  /**
   * Atualizar a cor do nome do usuário no chat
   * PATCH /chats/:id/my-color
   */
  @Patch(':id/my-color')
  async updateMyColor(
    @Request() req,
    @Param('id') chatId: string,
    @Body('color') color: string,
  ) {
    return this.chatsService.updateMemberColor(chatId, req.user.userId, color);
  }

  @Patch(':id/my-background')
  async updateMyBackground(
    @Request() req,
    @Param('id') chatId: string,
    @Body('theme') theme: string,
  ) {
    return this.chatsService.updateMemberBackground(
      chatId,
      req.user.userId,
      theme,
    );
  }
}
