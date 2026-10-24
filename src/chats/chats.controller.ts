import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import {
  UpdateMemberBackgroundDto,
  UpdateMemberColorDto,
} from './dto/member-appearance.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @Patch('messages/:id')
  async editMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatsService.editMessage(messageId, user.userId, dto.content);
  }

  /**
   * Apagar mensagem
   * IMPORTANTE: Deve ficar ANTES de @Delete(':id')
   * DELETE /chats/messages/:id
   */
  @Delete('messages/:id')
  async deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) messageId: string,
  ) {
    return this.chatsService.deleteMessage(messageId, user.userId);
  }

  @Patch(':id')
  async updateChatDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: UpdateChatDto,
  ) {
    return this.chatsService.updateChatDetails(chatId, user.userId, dto);
  }

  /**
   * Criar novo chat em grupo
   * POST /chats/group
   */
  @Post('group')
  async createGroupChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChatDto,
  ) {
    return this.chatsService.createChat(user.userId, dto);
  }

  /**
   * Criar chat privado com outro usuário
   * POST /chats/private/:userId
   */
  @Post('private/:userId')
  async createPrivateChat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.chatsService.createPrivateChat(user.userId, targetUserId);
  }

  /**
   * Listar todos os chats do usuário
   * GET /chats
   */
  @Get()
  async getUserChats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.chatsService.getUserChats(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  /**
   * Obter detalhes de um chat
   * GET /chats/:id
   */
  @Get(':id')
  async getChatDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
  ) {
    return this.chatsService.getChatDetailsForMember(chatId, user.userId);
  }

  /**
   * Enviar mensagem
   * POST /chats/:id/messages
   */
  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatsService.sendMessage(chatId, user.userId, dto);
  }

  /**
   * Listar mensagens de um chat
   * GET /chats/:id/messages
   */
  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.chatsService.getMessages(
      chatId,
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  /**
   * Marcar mensagens como lidas
   * POST /chats/:id/mark-as-read
   */
  @Post(':id/mark-as-read')
  async markMessagesAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
  ) {
    return this.chatsService.markMessagesAsRead(chatId, user.userId);
  }

  /**
   * Adicionar membros ao chat
   * POST /chats/:id/members
   */
  @Post(':id/members')
  async addMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.chatsService.addMembers(chatId, user.userId, dto);
  }

  /**
   * Remover membro do chat
   * DELETE /chats/:id/members/:memberId
   */
  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.chatsService.removeMember(chatId, user.userId, memberId);
  }

  /**
   * Sair de um chat
   * POST /chats/:id/leave
   */
  @Post(':id/leave')
  async leaveChat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
  ) {
    return this.chatsService.leaveChat(chatId, user.userId);
  }

  /**
   * Deletar chat
   * DELETE /chats/:id
   */
  @Delete(':id')
  async deleteChat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
  ) {
    return this.chatsService.deleteChat(chatId, user.userId);
  }

  /**
   * Promover membro a Admin
   * PATCH /chats/:id/members/:memberId/promote
   */
  @Patch(':id/members/:memberId/promote')
  async promoteToAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Param('memberId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.chatsService.promoteToAdmin(chatId, user.userId, targetUserId);
  }

  /**
   * Atualizar a cor do nome do usuário no chat
   * PATCH /chats/:id/my-color
   */
  @Patch(':id/my-color')
  async updateMyColor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: UpdateMemberColorDto,
  ) {
    return this.chatsService.updateMemberColor(chatId, user.userId, dto.color);
  }

  @Patch(':id/my-background')
  async updateMyBackground(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: UpdateMemberBackgroundDto,
  ) {
    return this.chatsService.updateMemberBackground(
      chatId,
      user.userId,
      dto.theme,
    );
  }
}
