import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private notificationsService: NotificationsService,
  ) {}

  async createReport(reporterUserId: string, data: any) {
    // Usamos o undefined no lugar do null para satisfazer a tipagem DeepPartial do TypeORM
    const report = this.reportRepository.create({
      reason: data.reason,
      imageUrl: data.imageUrl,
      reporterUser: { id: reporterUserId },
      reportedUser: { id: data.reportedUserId },
      post: data.postId ? { id: data.postId } : undefined,
    });

    await this.reportRepository.save(report);

    // Notifica os admins sobre a nova denúncia
    await this.notificationsService.notifyAdmins(
      'Nova Denúncia Recebida 🚨',
      'Um usuário acabou de reportar um post. Acesse o painel para revisar.',
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
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');

    report.dismissed = true;
    return this.reportRepository.save(report);
  }
}
