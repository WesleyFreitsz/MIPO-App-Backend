import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportType } from './entities/report.entity';
import { ChatMessage } from '../chats/entities/chat-message.entity';
import { ChatMember } from '../chats/entities/chat-member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReportDto } from './dto/create-report.dto';
import { Post } from '../posts/entities/post.entity';
import { User, UserRole } from '../users/entities/user.entity';

const APPEAL_CONTACT = '[E-MAIL DE PRIVACIDADE]';

const REPORT_TARGET_LABEL: Record<ReportType, string> = {
  [ReportType.POST]: 'uma publicação',
  [ReportType.USER]: 'um perfil',
  [ReportType.CHAT_MESSAGE]: 'uma mensagem de chat',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatMember)
    private chatMemberRepository: Repository<ChatMember>,
    private notificationsService: NotificationsService,
  ) {}

  async createReport(reporterUserId: string, data: CreateReportDto) {
    if (data.reportedUserId === reporterUserId) {
      throw new BadRequestException('Você não pode denunciar a si mesmo.');
    }

    const type = data.chatMessageId
      ? ReportType.CHAT_MESSAGE
      : data.postId
        ? ReportType.POST
        : (data.type ?? ReportType.USER);
    if (data.chatMessageId) {
      await this.assertCanReportMessage(
        reporterUserId,
        data.reportedUserId,
        data.chatMessageId,
      );
    }

    // Usamos o undefined no lugar do null para satisfazer a tipagem DeepPartial do TypeORM
    const report = this.reportRepository.create({
      type,
      reason: data.reason,
      imageUrl: data.imageUrl ?? undefined,
      reporterUser: { id: reporterUserId },
      reportedUser: { id: data.reportedUserId },
      post: data.postId ? { id: data.postId } : undefined,
      chatMessage: data.chatMessageId ? { id: data.chatMessageId } : undefined,
    });

    await this.reportRepository.save(report);

    // Notifica os admins sobre a nova denúncia
    await this.notificationsService.notifyAdmins(
      'Nova Denúncia Recebida 🚨',
      `Um usuário denunciou ${REPORT_TARGET_LABEL[type]}. Acesse o painel para revisar.`,
      { type: 'general', reportId: report.id },
      [UserRole.ADMIN, UserRole.MODERATOR],
    );

    return report;
  }

  async findAll() {
    return this.reportRepository.find({
      where: { dismissed: false },
      order: { createdAt: 'DESC' },
    });
  }

  async dismiss(id: string) {
    const report = await this.findOpen(id);
    return this.resolve(
      report,
      'Analisamos sua denúncia e não encontramos violação das regras.',
    );
  }

  async removePost(id: string) {
    const report = await this.findOpen(id);
    if (!report.post) {
      throw new BadRequestException('Esta denúncia não tem post vinculado.');
    }
    await this.postRepository.delete(report.post.id);
    await this.notifyReported(
      report,
      'Uma publicação sua foi removida',
      `Ela violou as diretrizes da comunidade (motivo da denúncia: ${report.reason}).`,
    );
    return this.resolve(
      report,
      'O post que você denunciou foi removido. Obrigado por ajudar!',
    );
  }

  async removeChatMessage(id: string) {
    const report = await this.findOpen(id);
    if (!report.chatMessage) {
      throw new BadRequestException(
        'Esta denúncia não tem mensagem vinculada.',
      );
    }
    await this.chatMessageRepository.update(report.chatMessage.id, {
      content: '',
      imageUrl: null,
      isDeleted: true,
    });
    await this.notifyReported(
      report,
      'Uma mensagem sua foi removida',
      `Ela violou as diretrizes da comunidade (motivo da denúncia: ${report.reason}).`,
    );
    return this.resolve(
      report,
      'A mensagem que você denunciou foi removida. Obrigado por ajudar!',
    );
  }

  async banReportedUser(id: string) {
    const report = await this.findOpen(id);
    await this.notifyReported(
      report,
      'Sua conta foi suspensa',
      'Sua conta violou as diretrizes da comunidade.',
    );
    await this.userRepository.update(report.reportedUser.id, { banned: true });
    return this.resolve(
      report,
      'O usuário que você denunciou foi banido. Obrigado por ajudar!',
    );
  }

  private async assertCanReportMessage(
    reporterUserId: string,
    reportedUserId: string,
    chatMessageId: string,
  ) {
    const message = await this.chatMessageRepository.findOne({
      where: { id: chatMessageId },
      select: { id: true, chatId: true, userId: true },
    });
    const isMember =
      message &&
      (await this.chatMemberRepository.exists({
        where: { chatId: message.chatId, userId: reporterUserId },
      }));
    if (!message || message.userId !== reportedUserId || !isMember) {
      throw new BadRequestException('Mensagem não encontrada.');
    }
  }

  // ECA Digital art. 30: quem é afetado pela moderação recebe o motivo e um canal de contestação.
  private notifyReported(report: Report, title: string, reason: string) {
    return this.notificationsService.sendToUser(
      report.reportedUser.id,
      title,
      `${reason} Se discordar, conteste pelo e-mail ${APPEAL_CONTACT}.`,
      'shield',
      'ALERT',
      { type: 'general', reportId: report.id },
    );
  }

  private async findOpen(id: string) {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    return report;
  }

  private async resolve(report: Report, feedback: string) {
    report.dismissed = true;
    const saved = await this.reportRepository.save(report);
    await this.notificationsService.sendToUser(
      report.reporterUser.id,
      'Sua denúncia foi analisada',
      feedback,
      'shield',
      'ALERT',
      { type: 'general', reportId: report.id },
    );
    return saved;
  }
}
