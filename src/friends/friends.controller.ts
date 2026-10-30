import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { FriendsService } from './friends.service';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  /**
   * Enviar solicitação de amizade
   * POST /friends/request
   */
  @Post('request')
  async sendFriendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFriendshipDto,
  ) {
    return this.friendsService.sendFriendRequest(user.userId, dto);
  }

  /**
   * Aceitar solicitação de amizade
   * POST /friends/:id/accept
   */
  @Post(':id/accept')
  async acceptFriendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) friendshipId: string,
  ) {
    return this.friendsService.acceptFriendRequest(user.userId, friendshipId);
  }

  /**
   * Rejeitar solicitação de amizade
   * DELETE /friends/:id/reject
   */
  @Delete(':id/reject')
  async rejectFriendRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) friendshipId: string,
  ) {
    return this.friendsService.rejectFriendRequest(user.userId, friendshipId);
  }

  /**
   * Listar amigos do usuário
   * GET /friends
   */
  @Get()
  async getFriends(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.friendsService.getFriends(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  /**
   * Listar solicitações de amizade recebidas
   * GET /friends/requests
   */
  @Get('requests/pending')
  async getFriendRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.friendsService.getFriendRequests(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  /**
   * Listar usuários disponíveis para adicionar
   * GET /friends/available
   */
  @Get('available/users')
  async getAvailableUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.friendsService.getAvailableUsers(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  @Get('search')
  async searchUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchUsersQueryDto,
  ) {
    return this.friendsService.searchUsers(
      user.userId,
      query.q,
      query.skip,
      query.take,
    );
  }

  @Get('blocked')
  async getBlockedUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.friendsService.getBlockedUsers(user.userId);
  }

  /**
   * Verificar status de amizade
   * GET /friends/:userId/status
   */
  @Get(':userId/status')
  async getFriendshipStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.friendsService.getFriendshipStatus(user.userId, userId);
  }

  /**
   * Remover amigo
   * DELETE /friends/:friendId
   */
  @Delete(':friendId')
  async removeFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ) {
    return this.friendsService.removeFriend(user.userId, friendId);
  }

  /**
   * Bloquear usuário
   * POST /friends/:userId/block
   */
  @Post(':userId/block')
  async blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.friendsService.blockUser(user.userId, userId);
  }
}
