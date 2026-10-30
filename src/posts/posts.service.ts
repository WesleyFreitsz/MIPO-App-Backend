import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { PostComment } from './entities/post-comment.entity';
import { PostLike } from './entities/post-like.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway'; // Importado para Real-time
import { extractMentions } from './mentions';

type PostWithCounts = Post & { likeCount?: number; commentCount?: number };

import { assertAllowedContent } from 'src/common/content-filter';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(PostComment)
    private commentRepository: Repository<PostComment>,
    @InjectRepository(PostLike)
    private likeRepository: Repository<PostLike>,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway, // Injetado para emitir eventos de socket
  ) {}

  async createPost(userId: string, dto: CreatePostDto) {
    assertAllowedContent(dto.content);
    if (!dto.content.trim() && !dto.imageUrl) {
      throw new BadRequestException('O post precisa de texto ou imagem.');
    }

    const post = this.postRepository.create({
      userId,
      content: dto.content,
      imageUrl: dto.imageUrl ?? null,
    });
    const savedPost = await this.postRepository.save(post);
    await this.notifyMentions(dto.content, userId, savedPost.id, 'post');
    return savedPost;
  }

  async getFeed(userId: string, skip = 0, take = 20) {
    const [posts, total] = await this.postsWithCountsQuery()
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return {
      data: await this.withLikeInfo(posts, userId),
      total,
      skip,
      take,
    };
  }

  async getUserPosts(authorId: string, viewerId: string, skip = 0, take = 20) {
    const [posts, total] = await this.postsWithCountsQuery()
      .where('post.userId = :authorId', { authorId })
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return {
      data: await this.withLikeInfo(posts, viewerId),
      total,
      skip,
      take,
    };
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

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    assertAllowedContent(dto.content);
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.userId !== userId)
      throw new ForbiddenException(
        'Você não tem permissão para atualizar este post',
      );

    if (dto.content !== undefined) post.content = dto.content;
    if (dto.imageUrl !== undefined) post.imageUrl = dto.imageUrl;

    if (!post.content.trim() && !post.imageUrl) {
      throw new BadRequestException('O post precisa de texto ou imagem.');
    }

    return this.postRepository.save(post);
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.userId !== userId)
      throw new ForbiddenException(
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

    // --- LÓGICA EM TEMPO REAL ---
    // Emite um evento global para que todos os fronts atualizem o contador de likes desse post
    this.notificationsGateway.broadcast({
      type: 'POST_LIKE_UPDATE',
      postId: postId,
      likeCount: await this.likeRepository.count({ where: { postId } }),
    });

    // Notificação Push para o dono do post
    if (post.userId !== userId) {
      const liker = await this.postRepository.manager.findOne(User, {
        where: { id: userId },
      });
      if (liker) {
        await this.notificationsService.sendToUser(
          post.userId,
          'Novo Like! ❤️',
          `@${liker.nickname || liker.name} curtiu seu post.`,
          'heart', // Ícone
          'ALERT', // Tipo
          { postId: post.id }, // <--- A MÁGICA DA NAVEGAÇÃO AQUI
        );
      }
    }

    return like;
  }

  async updateComment(commentId: string, userId: string, content: string) {
    assertAllowedContent(content);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.userId !== userId)
      throw new ForbiddenException(
        'Você não tem permissão para editar este comentário',
      );

    comment.content = content;
    // Opcional: Pode adicionar uma flag isEdited na entidade de comentários futuramente
    return this.commentRepository.save(comment);
  }

  async unlikePost(postId: string, userId: string) {
    const like = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    if (!like) throw new NotFoundException('Like não encontrado');

    await this.likeRepository.remove(like);

    // --- LÓGICA EM TEMPO REAL ---
    this.notificationsGateway.broadcast({
      type: 'POST_LIKE_UPDATE',
      postId: postId,
      likeCount: await this.likeRepository.count({ where: { postId } }),
    });

    return { message: 'Like removido com sucesso' };
  }

  async commentPost(postId: string, userId: string, dto: CreateCommentDto) {
    assertAllowedContent(dto.content);
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');

    const comment = this.commentRepository.create({
      postId,
      userId,
      content: dto.content,
    });
    await this.commentRepository.save(comment);
    await this.notifyMentions(dto.content, userId, post.id, 'comentário');

    if (post.userId !== userId) {
      const commenter = await this.postRepository.manager.findOne(User, {
        where: { id: userId },
      });
      if (commenter) {
        await this.notificationsService.sendToUser(
          post.userId,
          'Novo Comentário! 💬',
          `@${commenter.nickname || commenter.name} comentou no seu post.`,
          'message-circle', // Ícone
          'ALERT', // Tipo
          { postId: post.id }, // <--- A MÁGICA DA NAVEGAÇÃO AQUI
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
      relations: ['post'],
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.userId !== userId && comment.post?.userId !== userId)
      throw new ForbiddenException(
        'Você não tem permissão para deletar este comentário',
      );

    await this.commentRepository.remove(comment);
    return { message: 'Comentário deletado com sucesso' };
  }

  private async notifyMentions(
    content: string,
    authorId: string,
    postId: string,
    origin: 'post' | 'comentário',
  ) {
    const nicknames = extractMentions(content);
    if (nicknames.length === 0) return;

    const [author, mentioned] = await Promise.all([
      this.postRepository.manager.findOne(User, {
        where: { id: authorId },
        select: { id: true, name: true, nickname: true },
      }),
      this.postRepository.manager
        .createQueryBuilder(User, 'u')
        .select(['u.id'])
        .where('LOWER(u.nickname) IN (:...nicknames)', { nicknames })
        .andWhere({ id: Not(authorId), banned: false })
        .getMany(),
    ]);
    if (!author) return;

    await Promise.all(
      mentioned.map((user) =>
        this.notificationsService.sendToUser(
          user.id,
          'Você foi mencionado! 📣',
          `@${author.nickname || author.name} mencionou você em um ${origin}.`,
          'at-sign',
          'ALERT',
          { postId },
        ),
      ),
    );
  }

  private postsWithCountsQuery() {
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .loadRelationCountAndMap('post.likeCount', 'post.likes')
      .loadRelationCountAndMap('post.commentCount', 'post.comments');
  }

  private async withLikeInfo(posts: PostWithCounts[], viewerId: string) {
    const postIds = posts.map((post) => post.id);
    const likedPostIds = new Set(
      postIds.length > 0
        ? (
            await this.likeRepository.find({
              where: { userId: viewerId, postId: In(postIds) },
              select: { postId: true },
            })
          ).map((like) => like.postId)
        : [],
    );

    return posts.map((post) => ({
      ...post,
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      likedByUser: likedPostIds.has(post.id),
    }));
  }
}
