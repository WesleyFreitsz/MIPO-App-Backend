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
import { FriendsService } from './friends.service';
import { CreateFriendshipDto } from './dto/create-friendship.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  /**
   * Enviar solicitação de amizade
   * POST /friends/request
   */
  @Post('request')
  async sendFriendRequest(@Request() req, @Body() dto: CreateFriendshipDto) {
    return this.friendsService.sendFriendRequest(req.user.userId, dto);
  }

  /**
   * Aceitar solicitação de amizade
   * POST /friends/:id/accept
   */
  @Post(':id/accept')
  async acceptFriendRequest(@Request() req, @Param('id') friendshipId: string) {
    return this.friendsService.acceptFriendRequest(
      req.user.userId,
      friendshipId,
    );
  }

  /**
   * Rejeitar solicitação de amizade
   * DELETE /friends/:id/reject
   */
  @Delete(':id/reject')
  async rejectFriendRequest(@Request() req, @Param('id') friendshipId: string) {
    return this.friendsService.rejectFriendRequest(
      req.user.userId,
      friendshipId,
    );
  }

  /**
   * Listar amigos do usuário
   * GET /friends
   */
  @Get()
  async getFriends(
    @Request() req,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.friendsService.getFriends(req.user.userId, skip, take);
  }

  /**
   * Listar solicitações de amizade recebidas
   * GET /friends/requests
   */
  @Get('requests/pending')
  async getFriendRequests(
    @Request() req,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.friendsService.getFriendRequests(req.user.userId, skip, take);
  }

  /**
   * Listar usuários disponíveis para adicionar
   * GET /friends/available
   */
  @Get('available/users')
  async getAvailableUsers(
    @Request() req,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.friendsService.getAvailableUsers(req.user.userId, skip, take);
  }

  /**
   * Verificar status de amizade
   * GET /friends/:userId/status
   */
  @Get(':userId/status')
  async getFriendshipStatus(@Request() req, @Param('userId') userId: string) {
    return this.friendsService.getFriendshipStatus(req.user.userId, userId);
  }

  /**
   * Remover amigo
   * DELETE /friends/:friendId
   */
  @Delete(':friendId')
  async removeFriend(@Request() req, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(req.user.userId, friendId);
  }

  /**
   * Bloquear usuário
   * POST /friends/:userId/block
   */
  @Post(':userId/block')
  async blockUser(@Request() req, @Param('userId') userId: string) {
    return this.friendsService.blockUser(req.user.userId, userId);
  }
}
