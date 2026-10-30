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
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  /**
   * Criar novo post
   * POST /posts
   */
  @Post()
  async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(user.userId, dto);
  }

  /**
   * Listar posts do feed
   * GET /posts/feed
   */
  @Get('feed')
  async getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.postsService.getFeed(
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  /**
   * Listar posts de um usuário
   * GET /posts/user/:userId
   */
  @Get('user/:userId')
  async getUserPosts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.postsService.getUserPosts(
      userId,
      user.userId,
      pagination.skip,
      pagination.take,
    );
  }

  @Patch('comments/:id')
  async updateComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.updateComment(id, user.userId, dto.content);
  }

  @Delete('comments/:id')
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) commentId: string,
  ) {
    return this.postsService.deleteComment(commentId, user.userId);
  }

  @Get(':id')
  async getPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.getPost(postId, user.userId);
  }

  /**
   * Atualizar post
   * PUT /posts/:id
   */
  @Patch(':id') // Alterado de @Put para @Patch para maior compatibilidade
  async updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(postId, user.userId, dto);
  }

  /**
   * Deletar post
   * DELETE /posts/:id
   */
  @Delete(':id')
  async deletePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.deletePost(postId, user.userId, user.role);
  }

  /**
   * Dar like em um post
   * POST /posts/:id/like
   */
  @Post(':id/like')
  async likePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.likePost(postId, user.userId);
  }

  /**
   * Remover like de um post
   * DELETE /posts/:id/like
   */
  @Delete(':id/like')
  async unlikePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.postsService.unlikePost(postId, user.userId);
  }

  /**
   * Comentar em um post
   * POST /posts/:id/comments
   */
  @Post(':id/comments')
  async commentPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.commentPost(postId, user.userId, dto);
  }

  /**
   * Listar comentários de um post
   * GET /posts/:id/comments
   */
  @Get(':id/comments')
  async getPostComments(
    @Param('id', ParseUUIDPipe) postId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.postsService.getPostComments(
      postId,
      pagination.skip,
      pagination.take,
    );
  }
}
