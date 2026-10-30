import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

const STORE_HISTORY_MONTHS = 24;
const NOTIFICATIONS_MONTHS = 6;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 5 1 * *', { timeZone: 'America/Sao_Paulo' })
  async purgeExpiredData() {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `DELETE FROM order_tabs WHERE status = 'CLOSED' AND "closedAt" < now() - make_interval(months => $1)`,
          [STORE_HISTORY_MONTHS],
        );
        await manager.query(
          `DELETE FROM store_visits WHERE "checkedOutAt" IS NOT NULL AND "checkedOutAt" < now() - make_interval(months => $1)`,
          [STORE_HISTORY_MONTHS],
        );
        await manager.query(
          `DELETE FROM notifications WHERE "createdAt" < now() - make_interval(months => $1)`,
          [NOTIFICATIONS_MONTHS],
        );
      });
    } catch (error) {
      this.logger.error(
        'Erro no expurgo de dados antigos',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
