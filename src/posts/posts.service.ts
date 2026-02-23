import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostLike } from './entities/post-like.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(PostComment)
    private commentRepository: Repository<PostComment>,
    @InjectRepository(PostLike)
    private likeRepository: Repository<PostLike>,
    private notificationsService: NotificationsService, // Notificações injetadas
  ) {}

  async createPost(userId: string, dto: CreatePostDto) {
    const post = this.postRepository.create({
      userId,
      ...dto,
    });
    return this.postRepository.save(post);
  }

  async getFeed(userId: string, skip = 0, take = 20) {
    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['user', 'likes', 'comments'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const postsWithLikes = posts.map((post) => ({
      ...post,
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.length || 0,
      likedByUser: post.likes?.some((like) => like.userId === userId) || false,
    }));

    return { data: postsWithLikes, total, skip, take };
  }

  async getUserPosts(userId: string, skip = 0, take = 20) {
    const [posts, total] = await this.postRepository.findAndCount({
      where: { userId },
      relations: ['user', 'likes', 'comments'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const postsWithLikes = posts.map((post) => ({
      ...post,
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.length || 0,
      likedByUser: post.likes?.some((like) => like.userId === userId) || false,
    }));

    return { data: postsWithLikes, total, skip, take };
  }

  async getPost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: ['user', 'likes', 'comments', 'comments.user'],
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado');
    }

    return {
      ...post,
      likeCount: post.likes?.length || 0,
      commentCount: post.comments?.length || 0,
      likedByUser: post.likes?.some((like) => like.userId === userId) || false,
    };
  }

  async updatePost(postId: string, userId: string, dto: CreatePostDto) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.userId !== userId)
      throw new BadRequestException(
        'Você não tem permissão para atualizar este post',
      );

    Object.assign(post, dto);
    return this.postRepository.save(post);
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.userId !== userId)
      throw new BadRequestException(
        'Você não tem permissão para deletar este post',
      );

    await this.postRepository.remove(post);
    return { message: 'Post deletado com sucesso' };
  }

  async likePost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');

    const existingLike = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    if (existingLike)
      throw new BadRequestException('Você já deu like neste post');

    const like = this.likeRepository.create({ postId, userId });
    await this.likeRepository.save(like);

    // NOTIFICAÇÃO DE LIKE (Trava para não notificar a si mesmo)
    if (post.userId !== userId) {
      const liker = await this.postRepository.manager.findOne(User, {
        where: { id: userId },
      });
      if (liker) {
        await this.notificationsService.sendToUser(
          post.userId,
          'Novo Like! ❤️',
          `@${liker.nickname || liker.name} curtiu seu post.`,
        );
      }
    }

    return like;
  }

  async unlikePost(postId: string, userId: string) {
    const like = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    if (!like) throw new NotFoundException('Like não encontrado');

    await this.likeRepository.remove(like);
    return { message: 'Like removido com sucesso' };
  }

  async commentPost(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');

    const comment = this.commentRepository.create({ postId, userId, ...dto });
    await this.commentRepository.save(comment);

    // NOTIFICAÇÃO DE COMENTÁRIO (Trava para não notificar a si mesmo)
    if (post.userId !== userId) {
      const commenter = await this.postRepository.manager.findOne(User, {
        where: { id: userId },
      });
      if (commenter) {
        await this.notificationsService.sendToUser(
          post.userId,
          'Novo Comentário! 💬',
          `@${commenter.nickname || commenter.name} comentou no seu post.`,
        );
      }
    }

    return comment;
  }

  async getPostComments(postId: string, skip = 0, take = 20) {
    const [comments, total] = await this.commentRepository.findAndCount({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data: comments, total, skip, take };
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.userId !== userId)
      throw new BadRequestException(
        'Você não tem permissão para deletar este comentário',
      );

    await this.commentRepository.remove(comment);
    return { message: 'Comentário deletado com sucesso' };
  }
}
