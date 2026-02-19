import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from 'src/auth/jwt.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  /**
   * Criar novo post
   * POST /posts
   */
  @Post()
  async createPost(@Request() req, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(req.user.userId, dto);
  }

  /**
   * Listar posts do feed
   * GET /posts/feed
   */
  @Get('feed')
  async getFeed(
    @Request() req,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.postsService.getFeed(req.user.userId, skip, take);
  }

  /**
   * Listar posts de um usuário
   * GET /posts/user/:userId
   */
  @Get('user/:userId')
  async getUserPosts(
    @Request() req,
    @Param('userId') userId: string,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.postsService.getUserPosts(userId, skip, take);
  }

  /**
   * Obter um post específico
   * GET /posts/:id
   */
  @Get(':id')
  async getPost(@Request() req, @Param('id') postId: string) {
    return this.postsService.getPost(postId, req.user.userId);
  }

  /**
   * Atualizar post
   * PUT /posts/:id
   */
  @Put(':id')
  async updatePost(
    @Request() req,
    @Param('id') postId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.updatePost(postId, req.user.userId, dto);
  }

  /**
   * Deletar post
   * DELETE /posts/:id
   */
  @Delete(':id')
  async deletePost(@Request() req, @Param('id') postId: string) {
    return this.postsService.deletePost(postId, req.user.userId);
  }

  /**
   * Dar like em um post
   * POST /posts/:id/like
   */
  @Post(':id/like')
  async likePost(@Request() req, @Param('id') postId: string) {
    return this.postsService.likePost(postId, req.user.userId);
  }

  /**
   * Remover like de um post
   * DELETE /posts/:id/like
   */
  @Delete(':id/like')
  async unlikePost(@Request() req, @Param('id') postId: string) {
    return this.postsService.unlikePost(postId, req.user.userId);
  }

  /**
   * Comentar em um post
   * POST /posts/:id/comments
   */
  @Post(':id/comments')
  async commentPost(
    @Request() req,
    @Param('id') postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.commentPost(postId, req.user.userId, dto);
  }

  /**
   * Listar comentários de um post
   * GET /posts/:id/comments
   */
  @Get(':id/comments')
  async getPostComments(
    @Request() req,
    @Param('id') postId: string,
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.postsService.getPostComments(postId, skip, take);
  }

  /**
   * Deletar comentário
   * DELETE /comments/:id
   */
  @Delete('comments/:id')
  async deleteComment(@Request() req, @Param('id') commentId: string) {
    return this.postsService.deleteComment(commentId, req.user.userId);
  }
}
