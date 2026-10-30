import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { isUniqueViolation } from 'src/common/database-errors';
import { currentMonthlyPeriod } from 'src/monthly-games/monthly-games.ranking';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';
import { storeMonthRange } from 'src/store-visits/store-visits.stats';
import { Order, OrderStatus } from 'src/orders/entities/order.entity';
import { VisitReview } from './entities/visit-review.entity';
import { OrderReview } from './entities/order-review.entity';
import { CreateOrderReviewDto, CreateVisitReviewDto } from './dto/review.dto';
import { aggregateReviewStats, reviewsToCsv } from './reviews.stats';

const PENDING_WINDOW_MS = 48 * 60 * 60 * 1000;
const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  nickname: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(VisitReview)
    private visitReviewRepository: Repository<VisitReview>,
    @InjectRepository(OrderReview)
    private orderReviewRepository: Repository<OrderReview>,
    @InjectRepository(StoreVisit)
    private visitRepository: Repository<StoreVisit>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  async getPending(userId: string) {
    const visit = await this.visitRepository.findOne({
      where: {
        userId,
        checkedOutAt: MoreThanOrEqual(new Date(Date.now() - PENDING_WINDOW_MS)),
      },
      select: { id: true, checkedInAt: true, checkedOutAt: true },
      order: { checkedOutAt: 'DESC' },
    });
    if (!visit) return null;
    const alreadyReviewed = await this.visitReviewRepository.exists({
      where: { visitId: visit.id },
    });
    if (alreadyReviewed) return null;

    const orders = await this.orderRepository.find({
      where: { tab: { visitId: visit.id }, status: OrderStatus.DONE },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    });
    const reviewed = orders.length
      ? await this.orderReviewRepository.find({
          where: { orderId: In(orders.map((o) => o.id)) },
          select: { orderId: true },
        })
      : [];
    const reviewedIds = new Set(reviewed.map((r) => r.orderId));

    return {
      visit,
      orders: orders
        .filter((order) => !reviewedIds.has(order.id))
        .map((order) => ({
          id: order.id,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            kind: item.kind,
            nameSnapshot: item.nameSnapshot,
            quantity: item.quantity,
          })),
        })),
    };
  }

  async reviewVisit(
    userId: string,
    visitId: string,
    dto: CreateVisitReviewDto,
  ) {
    const visit = await this.visitRepository.findOne({
      where: { id: visitId, userId },
      select: { id: true, checkedOutAt: true },
    });
    if (!visit) throw new NotFoundException('Visita não encontrada.');
    if (!visit.checkedOutAt) {
      throw new BadRequestException(
        'Você pode avaliar depois de sair da loja.',
      );
    }
    return this.saveOnce(
      () =>
        this.visitReviewRepository.save(
          this.visitReviewRepository.create({
            visitId,
            userId,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
          }),
        ),
      'Você já avaliou essa visita.',
    );
  }

  async reviewOrder(
    userId: string,
    orderId: string,
    dto: CreateOrderReviewDto,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { tab: true },
    });
    if (!order || order.tab.userId !== userId) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    if (order.status !== OrderStatus.DONE) {
      throw new BadRequestException('Só dá para avaliar pedidos entregues.');
    }
    return this.saveOnce(
      () =>
        this.orderReviewRepository.save(
          this.orderReviewRepository.create({
            orderId,
            userId,
            rating: dto.rating,
          }),
        ),
      'Você já avaliou esse pedido.',
    );
  }

  async getStats(year?: number, month?: number) {
    const period = this.period(year, month);
    const [visitReviews, orderReviews] = await this.monthReviews(period);
    return {
      ...period,
      ...aggregateReviewStats(
        visitReviews,
        orderReviews.map((review) => ({
          rating: review.rating,
          items: review.order.items,
        })),
      ),
    };
  }

  async exportCsv(year?: number, month?: number) {
    const [visitReviews] = await this.monthReviews(this.period(year, month));
    return reviewsToCsv(visitReviews);
  }

  private period(year?: number, month?: number) {
    const current = currentMonthlyPeriod();
    return { year: year ?? current.year, month: month ?? current.month };
  }

  private monthReviews({ year, month }: { year: number; month: number }) {
    const { from, to } = storeMonthRange(year, month);
    const createdAt = Between(from, new Date(to.getTime() - 1));
    // shortcut: agrega em memória as avaliações do mês; trocar por GROUP BY se passar de dezenas de milhares por mês.
    return Promise.all([
      this.visitReviewRepository.find({
        where: { createdAt },
        relations: { user: true },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: PUBLIC_USER_FIELDS,
        },
      }),
      this.orderReviewRepository.find({
        where: { createdAt },
        relations: { order: { items: true } },
      }),
    ]);
  }

  private async saveOnce<T>(save: () => Promise<T>, conflictMessage: string) {
    try {
      return await save();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(conflictMessage);
      }
      throw error;
    }
  }
}
